export interface Request {
  /**
   * The URL which this HTTP request should be delivered to
   */
  url: string

  /**
   * The type of HTTP method. Usually GET or POST
   */
  method: string

  /**
   * Matadata is something which can be applied to a Request, which will
   * be passed on to the function which consumes this request. By inserting
   * data here, you are able to forward any data you need as a Source developer
   * to the methods meant to parse the returning data
   */
  metadata?: any

  /**
   * Any HTTP headers which should be applied to this request
   */
  headers?: Record<string, string>

  //TODO: Data documentatino may need edited
  /**
   * Data which 
   */
  data?: any

  /**
   * If the request takes longer than this value to process, it will fail and timeout
   */
  timeout?: number

  /**
   * Formatted parameters which are to be associated to the end of the URL.
   * Eg: ?paramOne=ImportantData&paramTwo=MoreData
   */
  param?: string // parameters need to be formatted to be attached to url

  /**
   * Any formatted cookies which should be inserted into the header
   */
  cookies?: Cookie[] // cookies need to be formatted to be put into headers

  /**
   * A toggle for if this request should be made in incognito mode or not
   */
  incognito?: boolean
}

export interface Cookie {
  name: string
  value: string
  domain: string
  path?: string
  created?: Date
  expires?: Date
}

declare global {
  function createRequestObject(requestObject: Request): Request
  function createCookie(cookie: Cookie): Cookie
}
