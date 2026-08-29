import Sale from "../models/sale.model"
import { Types, type PipelineStage } from "mongoose"
import { fromCursor, toCursor } from "../helpers/cursor"

const CURSOR_TYPE = "salesTransaction"

export const salesReportResolver = {
  Query: {
    salesTransactionTable: async (
      _: any,
      {
        first = 10,
        after,
        search,
        start,
        end,
        sort,
      }: {
        first?: number
        after?: string
        search?: string
        start?: string
        end?: string
        sort?: { key: string; order: "ASC" | "DESC" }
      }
    ) => {
      try {
        const sortKey = sort?.key || "date"
        const sortOrder = sort?.order === "ASC" ? 1 : -1

        const baseStages: PipelineStage[] = [
          // Sales carried over from the previous POS have no line items and
          // took no money here, so they are not this system's revenue.
          { $match: { isImported: { $ne: true } } },
          {
            $lookup: {
              from: "customers",
              localField: "customer",
              foreignField: "_id",
              as: "customer",
            },
          },
          { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "users",
              localField: "by",
              foreignField: "_id",
              as: "by",
            },
          },
          { $unwind: { path: "$by", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "registers",
              localField: "register",
              foreignField: "_id",
              as: "registerDoc",
            },
          },
          {
            $unwind: { path: "$registerDoc", preserveNullAndEmptyArrays: true },
          },
          {
            $lookup: {
              from: "outlets",
              localField: "registerDoc.outlet",
              foreignField: "_id",
              as: "outletDoc",
            },
          },
          { $unwind: { path: "$outletDoc", preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              date: "$createdAt",
              customerName: { $ifNull: ["$customer.name", "Walk-in"] },
              outletName: { $ifNull: ["$outletDoc.name", "-"] },
              byName: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$by.name", ""] },
                      " ",
                      { $ifNull: ["$by.surname", ""] },
                    ],
                  },
                },
              },
            },
          },
          ...(search
            ? [{ $match: { saleNumber: { $regex: search, $options: "i" } } }]
            : []),
          ...(start && end
            ? [
                {
                  $match: {
                    date: {
                      $gte: new Date(start),
                      $lte: new Date(end),
                    },
                  },
                },
              ]
            : []),
        ]

        const [countResult] = await Sale.aggregate([
          ...baseStages,
          { $count: "total" },
        ])
        const total = countResult?.total || 0

        const paginationStages: PipelineStage[] = []
        if (after) {
          const { id, type, value } = fromCursor(after)
          if (type !== CURSOR_TYPE) throw new Error("Invalid cursor")
          const cursorId = new Types.ObjectId(id)
          const cursorValue = sortKey === "date" ? new Date(value) : value
          paginationStages.push({
            $match: {
              $or: [
                {
                  [sortKey]:
                    sortOrder === 1
                      ? { $gt: cursorValue }
                      : { $lt: cursorValue },
                },
                {
                  [sortKey]: cursorValue,
                  _id: sortOrder === 1 ? { $gt: cursorId } : { $lt: cursorId },
                },
              ],
            },
          })
        }

        const result = await Sale.aggregate([
          ...baseStages,
          ...paginationStages,
          { $sort: { [sortKey]: sortOrder, _id: sortOrder } },
          { $limit: first + 1 },
          {
            $lookup: {
              from: "payment_methods",
              localField: "payments.method",
              foreignField: "_id",
              as: "paymentMethodDocs",
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "items.product",
              foreignField: "_id",
              as: "productDocs",
            },
          },
          {
            $project: {
              saleNumber: 1,
              date: 1,
              customerName: 1,
              outletName: 1,
              byName: 1,
              total: 1,
              currentSaleStatus: 1,
              isOnAccount: 1,
              items: 1,
              paymentMethodDocs: 1,
              productDocs: 1,
            },
          },
        ])

        const sliced = result.slice(0, first)
        const edges = sliced.map((edge: any) => {
          const skuByProduct = new Map(
            (edge.productDocs || []).map((p: any) => [p._id.toString(), p.sku])
          )
          return {
            node: {
              _id: edge._id,
              saleNumber: edge.saleNumber,
              date: edge.date,
              customerName: edge.customerName,
              outletName: edge.outletName,
              itemsSummary: (edge.items || [])
                .map((item: any) => `${item.snapshotName} (${item.quantity})`)
                .join(", "),
              items: (edge.items || []).map((item: any) => ({
                name: item.snapshotName,
                sku: skuByProduct.get(item.product?.toString()) || "-",
                quantitySold: item.quantity,
                sales: item.total,
                discounts: item.discount * item.quantity,
              })),
              currentSaleStatus: edge.currentSaleStatus,
              isOnAccount: edge.isOnAccount,
              paymentTypes: [
                ...new Set(
                  (edge.paymentMethodDocs || []).map((pm: any) => pm.name)
                ),
              ],
              total: edge.total,
              byName: edge.byName || "-",
            },
            cursor: toCursor({
              type: CURSOR_TYPE,
              id: edge._id.toString(),
              value: edge[sortKey],
            }),
          }
        })

        return {
          total,
          pages: Math.ceil(total / first),
          edges,
          pageInfo: {
            endCursor: sliced.length
              ? toCursor({
                  type: CURSOR_TYPE,
                  id: sliced[sliced.length - 1]._id.toString(),
                  value: sliced[sliced.length - 1][sortKey],
                })
              : null,
            hasNextPage: result.length > first,
          },
        }
      } catch (error) {
        throw error
      }
    },
    salesByItemTable: async (
      _: any,
      { start, end }: { start: string; end: string }
    ) => {
      try {
        const rangeStart = new Date(start)
        const rangeEnd = new Date(end)

        const pipeline: PipelineStage[] = [
          {
            $match: {
              currentSaleStatus: { $ne: "VOIDED" },
              isImported: { $ne: true },
              createdAt: { $gte: rangeStart, $lte: rangeEnd },
            },
          },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.product",
              name: { $first: "$items.snapshotName" },
              quantitySold: { $sum: "$items.quantity" },
              salesExTax: { $sum: "$items.total" },
              discounts: {
                $sum: { $multiply: ["$items.discount", "$items.quantity"] },
              },
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "_id",
              as: "product",
            },
          },
          { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              name: 1,
              sku: { $ifNull: ["$product.sku", "-"] },
              quantitySold: 1,
              salesExTax: 1,
              discounts: 1,
            },
          },
          { $sort: { salesExTax: -1 } },
        ]

        return await Sale.aggregate(pipeline)
      } catch (error) {
        throw error
      }
    },
    salesOutlets: async (
      _: any,
      { start, end }: { start: string; end: string }
    ) => {
      try {
        const rangeStart = new Date(start)
        const rangeEnd = new Date(end)

        const pipeline: PipelineStage[] = [
          {
            $match: {
              isImported: { $ne: true },
              createdAt: { $gte: rangeStart, $lte: rangeEnd },
            },
          },
          {
            $lookup: {
              from: "registers",
              localField: "register",
              foreignField: "_id",
              as: "register",
            },
          },
          { $unwind: { path: "$register", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "outlets",
              localField: "register.outlet",
              foreignField: "_id",
              as: "outlet",
            },
          },
          { $unwind: { path: "$outlet", preserveNullAndEmptyArrays: true } },
          { $match: { "outlet.name": { $ne: null } } },
          { $group: { _id: "$outlet.name" } },
          { $sort: { _id: 1 } },
        ]

        const result = await Sale.aggregate(pipeline)
        return result.map((r) => r._id)
      } catch (error) {
        throw error
      }
    },
  },
}
