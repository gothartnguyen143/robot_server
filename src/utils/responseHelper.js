/**
 * Response Helper Utility
 * Standardizes API response format
 */

class ResponseHelper {
  /**
   * Create a success response
   * @param {any} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   * @returns {Object} Standardized response object
   */
  static success(data = null, message = "Request successful", statusCode = 200) {
    return {
      success: true,
      statusCode,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create an error response
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {any} data - Additional error data
   * @returns {Object} Standardized error response object
   */
  static error(message = "Request failed", statusCode = 500, data = null) {
    return {
      success: false,
      statusCode,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a not found response
   * @param {string} resource - Resource name
   * @returns {Object} Not found response
   */
  static notFound(resource = "Resource") {
    return this.error(`${resource} not found`, 404);
  }

  /**
   * Create a bad request response
   * @param {string} message - Error message
   * @returns {Object} Bad request response
   */
  static badRequest(message = "Bad request") {
    return this.error(message, 400);
  }

  /**
   * Create an internal server error response
   * @param {string} message - Error message
   * @returns {Object} Internal server error response
   */
  static internalError(message = "Internal server error") {
    return this.error(message, 500);
  }
}

module.exports = ResponseHelper;