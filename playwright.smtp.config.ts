import { defineConfig } from '@playwright/test';
import local from './playwright.local.config';
export default defineConfig({ ...local, testDir: './tests/smtp' });
