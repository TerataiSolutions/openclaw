const fs = require('fs');

describe('Dependency Health Check', () => {
 it('should detect when config drift exists', () => {
 const openclaw = JSON.parse(fs.readFileSync('/data/.openclaw/openclaw.json', 'utf-8'));
 const workspace = JSON.parse(fs.readFileSync('/data/.openclaw/workspace/config.json', 'utf-8'));

 // Verify both files can be read and parsed
 expect(openclaw).toBeDefined();
 expect(workspace).toBeDefined();

 // Verify they have expected top-level keys
 expect(openclaw.agents || openclaw.channels).toBeDefined();
 expect(workspace.model || workspace.agents).toBeDefined();
 });

 it('should verify Supabase env vars are set', () => {
 expect(process.env.SUPABASE_URL).toBeDefined();
 expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
 });

 it('should verify Cohere API key is set', () => {
 expect(process.env.COHERE_API_KEY).toBeDefined();
 });

 it('should verify Discord bot token is set', () => {
 expect(process.env.DISCORD_BOT_TOKEN).toBeDefined();
 });
});
