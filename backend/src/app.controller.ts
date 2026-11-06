import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from './common/decorators/public.decorator';
import { HealthService } from './modules/health/health.service';

@ApiTags('System Status')
@Controller()
export class AppController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  async getRoot(@Req() req: Request, @Res() res: Response) {
    return this.renderStatusPage(req, res);
  }

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'System Status Landing Page (HTML / JSON)' })
  @ApiResponse({ status: 200, description: 'Returns system operational status' })
  async getStatus(@Req() req: Request, @Res() res: Response) {
    return this.renderStatusPage(req, res);
  }

  private async renderStatusPage(req: Request, res: Response) {
    const liveness = this.healthService.getLiveness();
    const { report: readiness } = await this.healthService.getReadiness();

    // If client requested JSON via Accept header or ?format=json
    if (
      req.headers.accept?.includes('application/json') ||
      req.query.format === 'json'
    ) {
      return res.status(200).json({
        status: 'online',
        message: 'Medora 2.0 Hospital Backend is running successfully.',
        liveness,
        readiness,
      });
    }

    const dbStatus = readiness.checks.database.status;
    const isDbConnected = dbStatus === 'connected';
    const uptimeStr = this.formatUptime(liveness.uptimeSeconds);
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const fullUrl = `${protocol}://${host}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Medora 2.0 — Backend Service Operational</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0284c7;
      --primary-light: #e0f2fe;
      --success: #16a34a;
      --success-light: #dcfce7;
      --bg-page: #f8fafc;
      --bg-card: #ffffff;
      --border-color: #e2e8f0;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --radius: 12px;
      --shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05);
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg-page);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .container {
      width: 100%;
      max-width: 780px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06), 0 8px 10px -6px rgba(0,0,0,0.04);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%);
      padding: 36px 32px;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .logo-icon {
      width: 48px;
      height: 48px;
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(8px);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .title-group h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .title-group p {
      font-size: 13px;
      opacity: 0.9;
      margin-top: 2px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      color: #15803d;
      padding: 8px 16px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 13px;
      box-shadow: var(--shadow);
    }
    .pulse-dot {
      width: 10px;
      height: 10px;
      border-radius: 9999px;
      background-color: #22c55e;
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
      }
    }
    .body-content {
      padding: 32px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .metric-card {
      background: var(--bg-page);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 16px;
    }
    .metric-label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }
    .metric-value {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .links-section {
      margin-top: 24px;
      border-top: 1px solid var(--border-color);
      padding-top: 24px;
    }
    .links-section h3 {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }
    .button-group {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .btn-primary {
      background: var(--primary);
      color: #ffffff;
      border: 1px solid var(--primary);
    }
    .btn-primary:hover {
      background: #0369a1;
    }
    .btn-secondary {
      background: #ffffff;
      color: var(--text-main);
      border: 1px solid var(--border-color);
    }
    .btn-secondary:hover {
      background: var(--bg-page);
      border-color: #cbd5e1;
    }
    .modules-tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    .module-pill {
      font-size: 11.5px;
      padding: 4px 10px;
      background: var(--bg-page);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .footer {
      background: var(--bg-page);
      border-top: 1px solid var(--border-color);
      padding: 14px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--text-muted);
    }
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: var(--bg-page);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-area">
        <div class="logo-icon">🏥</div>
        <div class="title-group">
          <h1>Medora 2.0 Backend</h1>
          <p>Hospital Clinical & Administrative API Service</p>
        </div>
      </div>
      <div class="status-badge">
        <div class="pulse-dot"></div>
        <span>System Operational</span>
      </div>
    </div>

    <div class="body-content">
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">API Status</div>
          <div class="metric-value" style="color: #16a34a;">HTTP 200 OK</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Database Connection</div>
          <div class="metric-value" style="color: ${isDbConnected ? '#16a34a' : '#dc2626'};">
            ${isDbConnected ? '● PostgreSQL Online' : '○ DB Offline'}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-label">System Uptime</div>
          <div class="metric-value">${uptimeStr}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">API Version</div>
          <div class="metric-value">v2.0.0 (NestJS 11)</div>
        </div>
      </div>

      <div class="links-section">
        <h3>API Reference & Diagnostics</h3>
        <div class="button-group">
          <a href="/api/docs" class="btn btn-primary">
            <span>📖 OpenAPI Swagger Docs</span>
          </a>
          <a href="/api/v1/health" class="btn btn-secondary">
            <span>🩺 Health Liveness</span>
          </a>
          <a href="/api/v1/health/ready" class="btn btn-secondary">
            <span>🗄️ Database Readiness</span>
          </a>
          <a href="/status?format=json" class="btn btn-secondary">
            <span>📄 Raw JSON Metrics</span>
          </a>
        </div>
      </div>

      <div class="links-section">
        <h3>Integrated Clinical Modules</h3>
        <div class="modules-tag-list">
          <span class="module-pill">Authentication & RBAC</span>
          <span class="module-pill">Patient Management</span>
          <span class="module-pill">Doctor Directory</span>
          <span class="module-pill">Departments Catalogue</span>
          <span class="module-pill">OPD Appointments</span>
          <span class="module-pill">Doctor Consultations</span>
          <span class="module-pill">Invoices & Billing</span>
          <span class="module-pill">Electronic Prescriptions</span>
          <span class="module-pill">Pharmacy & Inventory</span>
          <span class="module-pill">Medicine Catalogue</span>
          <span class="module-pill">Laboratory (LIS)</span>
          <span class="module-pill">Radiology (RIS)</span>
          <span class="module-pill">Inpatient & Beds (IPD)</span>
          <span class="module-pill">Cashier & Shifts</span>
          <span class="module-pill">Staff & HR Management</span>
          <span class="module-pill">Accounting & General Ledger</span>
          <span class="module-pill">Multi-Branch Administration</span>
          <span class="module-pill">Audit & Notification Center</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <span>Endpoint: <code>${fullUrl}/api/v1</code></span>
      <span>Medora 2.0 • High-Assurance Clinical System</span>
    </div>
  </div>
</body>
</html>`;

    return res.status(200).type('text/html').send(html);
  }

  private formatUptime(seconds: number): string {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }
}
