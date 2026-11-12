/**
 * Pagination Utility Helper
 */

/**
 * Extracts and sanitizes page, pageSize (limit), and skip values from query params
 */
export const getPaginationParams = (query, defaultLimit = 10, maxLimit = 100) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    maxLimit,
    Math.max(1, parseInt(query.pageSize || query.limit, 10) || defaultLimit)
  );
  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
};

/**
 * Formats a standardized paginated response
 */
export const formatPaginatedResponse = ({ total, page, pageSize, data }) => {
  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    success: true,
    total,
    page,
    pageSize,
    totalPages,
    data,
  };
};
