export interface IDataTableArgs {
  first?: number
  after?: string
  search?: string
  filter?: {
    type: FilterType
    key: string
    value: string
  }[]
  sort?: {
    key: string
    order: "ASC" | "DESC"
  }
}

export interface IOption {
  label: string
  value: string
}

export interface Filter {
  key: string
  value: string
  type: FilterType
}

export interface Sort {
  key: string
  order: "ASC" | "DESC"
}


export enum FilterType {
  TEXT = "TEXT",
  NUMBER = "NUMBER",
  DATE = "DATE",
  BOOLEAN = "BOOLEAN",
  SELECT = "SELECT",
}

export interface IPageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface IConnection<T> {
  total: number
  pages: number
  edges: {
    node: T
    cursor: string
  }[]
  pageInfo: IPageInfo
}

// Enums
export enum Day {
  SUNDAY = "SUNDAY",
  MONDAY = "MONDAY",
  TUESDAY = "TUESDAY",
  WEDNESDAY = "WEDNESDAY",
  THURSDAY = "THURSDAY",
  FRIDAY = "FRIDAY",
  SATURDAY = "SATURDAY",
}
