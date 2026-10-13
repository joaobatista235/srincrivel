/** Semantic failure shared by application ports; translated only at presentation. */
export class ApplicationError extends Error {
  constructor(code, details = {}, options) {
    super(code, options);
    this.name = 'ApplicationError';
    this.code = code;
    this.details = details;
  }
}
