import { API_CONFIG } from '../config.js';
import { createDatabaseRepository } from './db-repository.js';
import { createFileRepository } from './file-repository.js';

export const repository = API_CONFIG.mode === 'database' ? createDatabaseRepository() : createFileRepository();
