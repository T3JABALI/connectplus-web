import { USE_MOCK } from '../config';
import { realApi } from './api';
import { mockApi } from './mockApi';

export const api = USE_MOCK ? mockApi : realApi;
