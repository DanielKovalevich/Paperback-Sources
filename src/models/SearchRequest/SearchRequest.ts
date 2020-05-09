/**
 * The {@link SearchRequest} interface is a list of optional queries, which
 * can be packed together into a search request.
 * Everything is optional, allowing users flexibility to make a search however they
 * desire. As a Source developer, you should ensure that as many of these fields are handled
 * as fine searching is an important user feature.
 */
export interface SearchRequest {
  /**
   * The title of the search request. This usually is the plaintext query you are
   * making as a user
   */
  title?: string

  includeDemographic?: string[]

  includeTheme?: string[]
  includeFormat?: string[]
  includeContent?: string[]
  includeGenre?: string[]

  excludeDemographic?: string[]
  excludeTheme?: string[]
  excludeFormat?: string[]
  excludeContent?: string[]
  excludeGenre?: string[]

  includeOperator?: number
  excludeOperator?: number

  author?: string
  artist?: string
  status?: number
  hStatus?: boolean
}

declare global {
  function createSearchRequest(searchRequest: SearchRequest): SearchRequest
}