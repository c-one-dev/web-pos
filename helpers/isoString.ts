export const isISOString = (str: any): str is string => {
  return typeof str === "string" && !isNaN(Date.parse(str))
} 
