import { GraphQLError } from "graphql"
import type { PipelineStage } from "mongoose"
import TimeCard from "../models/timecard.model"

const fullName = (u: any) =>
  `${u?.name || ""} ${u?.surname || ""}`.trim() || "-"

export const timecardResolver = {
  Query: {
    activeTimeCard: async (_: any, __: any, ctx: any) => {
      try {
        return await TimeCard.findOne({
          user: ctx.session._id,
          clockOut: null,
        }).lean()
      } catch (error) {
        throw error
      }
    },
    timeCardByUserTable: async (
      _: any,
      { start, end, search }: { start: string; end: string; search?: string }
    ) => {
      try {
        const rangeStart = new Date(start)
        const rangeEnd = new Date(end)

        const pipeline: PipelineStage[] = [
          { $match: { clockIn: { $gte: rangeStart, $lte: rangeEnd } } },
          {
            $addFields: {
              hours: {
                $divide: [
                  {
                    $subtract: [
                      { $ifNull: ["$clockOut", new Date()] },
                      "$clockIn",
                    ],
                  },
                  1000 * 60 * 60,
                ],
              },
            },
          },
          { $group: { _id: "$user", hoursLogged: { $sum: "$hours" } } },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          {
            $addFields: {
              userName: {
                $trim: {
                  input: { $concat: ["$user.name", " ", "$user.surname"] },
                },
              },
            },
          },
          ...(search
            ? [{ $match: { userName: { $regex: search, $options: "i" } } }]
            : []),
          { $sort: { userName: 1 } },
          { $project: { _id: 1, userName: 1, hoursLogged: 1 } },
        ]

        return await TimeCard.aggregate(pipeline)
      } catch (error) {
        throw error
      }
    },
    timeCardByDateTable: async (
      _: any,
      { start, end, search }: { start: string; end: string; search?: string }
    ) => {
      try {
        const rangeStart = new Date(start)
        const rangeEnd = new Date(end)
        const cards = await TimeCard.find({
          clockIn: { $gte: rangeStart, $lte: rangeEnd },
        })
          .populate("user")
          .sort({ clockIn: -1 })
          .lean()

        return cards
          .filter(
            (c: any) =>
              !search ||
              fullName(c.user).toLowerCase().includes(search.toLowerCase())
          )
          .map((c: any) => {
            const clockOut = c.clockOut ? new Date(c.clockOut) : new Date()
            const hours =
              (clockOut.getTime() - new Date(c.clockIn).getTime()) / 3_600_000
            return {
              _id: c._id,
              date: c.clockIn,
              clockIn: c.clockIn,
              clockOut: c.clockOut || null,
              userName: fullName(c.user),
              hoursLogged: hours,
            }
          })
      } catch (error) {
        throw error
      }
    },
  },
  Mutation: {
    clockIn: async (_: any, __: any, ctx: any) => {
      try {
        const existing = await TimeCard.findOne({
          user: ctx.session._id,
          clockOut: null,
        }).lean()
        if (existing) throw new GraphQLError("You are already clocked in.")

        const created = await TimeCard.create({
          user: ctx.session._id,
          clockIn: new Date(),
        })

        return { ok: true, message: "Clocked in.", data: created }
      } catch (error) {
        throw error
      }
    },
    clockOut: async (_: any, __: any, ctx: any) => {
      try {
        const existing = await TimeCard.findOne({
          user: ctx.session._id,
          clockOut: null,
        })
        if (!existing) throw new GraphQLError("You are not clocked in.")

        existing.clockOut = new Date()
        await existing.save()

        return { ok: true, message: "Clocked out.", data: existing }
      } catch (error) {
        throw error
      }
    },
  },
}
