import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server.js';

async function runStdio() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Talkar Universal Spaces CRM MCP Server running on stdio');
}

runStdio().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});
