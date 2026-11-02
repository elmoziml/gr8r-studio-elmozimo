const notConfigured = () =>
  new Error(
    'The database repository is not configured. Implement src/api/repository/db-repository.js against database/schema.sql, then set VITE_API_MODE=database.',
  );

export function createDatabaseRepository() {
  return {
    kind: 'database',
    loadSync: () => null,
    async load() {
      throw notConfigured();
    },
    async save() {
      throw notConfigured();
    },
    async reset() {
      throw notConfigured();
    },
  };
}
