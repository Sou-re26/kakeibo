import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

const expoDb = SQLite.openDatabaseSync('kakeibo.db');
export const db = drizzle(expoDb);