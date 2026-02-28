/**
 * CivicVoice Workers — Main Router
 *
 * Routes incoming requests to the appropriate API handler.
 * Applies Amnesia Protocol middleware to ALL API endpoints at the router level.
 *
 * Routes:
 *   POST /api/report      → Report submission (Amnesia Endpoint)
 *   GET  /api/feed         → Feed retrieval with lane filtering
 *   GET  /api/reputation   → Fetch reputation score
 *   POST /api/reputation   → Update reputation
 *   POST /api/audio-gate   → Deepfake audio detection
 *   /api/admin/*           → Admin dashboard API (Module 7, Bearer auth)
 *   GET  /api/health       → Service health check
 */

import { amnesiaHeaderPurge } from './amnesia/headerPurge';
import { handleReportSubmission } from './api/report';
import { handleFeed } from './api/feed';
import { handleReputation } from './api/reputation';
import { handleAudioGate } from './api/audioGate';
import { handleAdmin } from './api/admin';

/* ─── Types ─── */

export interface Env {
    DB: D1Database;
    MEDIA_BUCKET?: R2Bucket;
    ADMIN_SECRET?: string;
}

/* ─── Security Headers ─── */

const SECURITY_HEADERS: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
};

/* ─── CORS ─── */

const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Request-Timestamp, Authorization',
    'Access-Control-Max-Age': '86400',
};

/**
 * Attach security + CORS headers to a response.
 */
function withSecurityHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        headers.set(key, value);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

/* ─── Main Router ─── */

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // CORS preflight for all API routes
        if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
            return new Response(null, {
                status: 204,
                headers: CORS_HEADERS,
            });
        }

        // Apply Amnesia header purge at the ROUTER level for ALL /api/ routes.
        // This ensures no handler ever sees PII headers — defense in depth.
        let processedRequest = request;
        if (pathname.startsWith('/api/')) {
            const { sanitizedRequest } = amnesiaHeaderPurge(request);
            processedRequest = sanitizedRequest;
        }

        // Route to appropriate handler
        try {
            let response: Response;

            if (pathname === '/api/report' || pathname === '/api/report/') {
                // report.ts applies its OWN amnesia purge for countryCode extraction,
                // so pass the ORIGINAL request to preserve cf-ipcountry before purge
                response = await handleReportSubmission(request, env);
            } else if (pathname === '/api/feed' || pathname === '/api/feed/') {
                response = await handleFeed(processedRequest, env);
            } else if (pathname === '/api/reputation' || pathname === '/api/reputation/') {
                response = await handleReputation(processedRequest, env);
            } else if (pathname === '/api/audio-gate' || pathname === '/api/audio-gate/') {
                response = await handleAudioGate(processedRequest, env);
            } else if (pathname.startsWith('/api/admin')) {
                response = await handleAdmin(processedRequest, env);
            } else if (pathname === '/api/health') {
                response = new Response(JSON.stringify({
                    status: 'ok',
                    service: 'civicvoice-api',
                    version: '1.0.0',
                    timestamp: new Date().toISOString(),
                    d1: !!env.DB,
                    r2: !!env.MEDIA_BUCKET,
                }), {
                    headers: { 'Content-Type': 'application/json' },
                });
            } else if (pathname.startsWith('/api/')) {
                // 404 for unknown API routes
                response = new Response(JSON.stringify({ error: 'Not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                });
            } else {
                // Non-API routes — let Cloudflare Pages handle (SPA fallback)
                return new Response('Not found', { status: 404 });
            }

            return withSecurityHeaders(response);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Internal server error';
            return withSecurityHeaders(new Response(JSON.stringify({ error: message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }));
        }
    },
};
