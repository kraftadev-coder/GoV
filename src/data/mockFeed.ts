/**
 * Mock feed data for Module 1: Dual-Lane Feed
 * Will be replaced by D1/API data in Module 5
 *
 * Forward-compatible: includes optional fields that
 * future modules (auth, media, backend) will populate.
 */

export interface WitnessPost {
    id: string;
    type: 'witness';
    geoLabel: string;
    contentHash: string;
    excerpt: string;
    score: number;
    timestamp: string;
    createdAt: string;       // ISO 8601 — used in <time> dateTime
    mediaUrl?: string;
    verified: boolean;
    category?: string;       // Future: report category
    upvotes?: number;        // Future: reputation engine
    verificationStatus?: 'witness-verified' | 'remote-verified' | 'pending';
}

export interface OpinionPost {
    id: string;
    type: 'opinion';
    handle: string;
    text: string;
    timestamp: string;
    createdAt: string;       // ISO 8601 — used in <time> dateTime
    upvotes?: number;        // Future: reputation engine
}

export type FeedPost = WitnessPost | OpinionPost;
export type FeedLane = 'social' | 'witness';

export const mockWitnessPosts: WitnessPost[] = [
    {
        id: 'w1',
        type: 'witness',
        geoLabel: 'LEKKI, LAGOS • DISTRICT 04',
        contentHash: 'a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
        excerpt:
            'Broken infrastructure on the Lekki-Epe Expressway — collapsed drainage, flooding residential areas. Evidence captured on-site with geo-verification.',
        score: 1250,
        timestamp: '2 hours ago',
        createdAt: '2026-02-28T08:52:00Z',
        verified: true,
        verificationStatus: 'witness-verified',
    },
    {
        id: 'w2',
        type: 'witness',
        geoLabel: 'IKEJA, LAGOS • DISTRICT 01',
        contentHash: 'b4c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
        excerpt:
            'Police checkpoint extortion documented at Allen Avenue junction. Officers demanding ₦5,000 from commercial drivers without issuing receipts.',
        score: 980,
        timestamp: '5 hours ago',
        createdAt: '2026-02-28T05:52:00Z',
        verified: true,
        verificationStatus: 'witness-verified',
    },
    {
        id: 'w3',
        type: 'witness',
        geoLabel: 'WUSE II, ABUJA • FCT',
        contentHash: 'c5d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9',
        excerpt:
            'Illegal demolition of residential buildings near Area 1. No prior notice served to occupants. Heavy machinery spotted at 6am.',
        score: 2100,
        timestamp: '1 day ago',
        createdAt: '2026-02-27T09:52:00Z',
        mediaUrl: '/mock-evidence.jpg',
        verified: true,
        verificationStatus: 'witness-verified',
    },
    {
        id: 'w4',
        type: 'witness',
        geoLabel: 'SURULERE, LAGOS • DISTRICT 07',
        contentHash: 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1',
        excerpt:
            'Public hospital emergency ward understaffed — only 2 nurses for 40+ patients. Long queues with no triage system in place.',
        score: 750,
        timestamp: '3 hours ago',
        createdAt: '2026-02-28T07:52:00Z',
        verified: false,
        verificationStatus: 'pending',
    },
];

export const mockOpinionPosts: OpinionPost[] = [
    {
        id: 'o1',
        type: 'opinion',
        handle: '@LagosResident',
        text: "The roads in Surulere need urgent attention. I've been driving through potholes for months. When will the government act?",
        timestamp: '45 min ago',
        createdAt: '2026-02-28T10:07:00Z',
    },
    {
        id: 'o2',
        type: 'opinion',
        handle: '@AbujaWatcher',
        text: 'Power supply has been stable this week in Wuse 2. Is this a new trend or just luck? Fingers crossed it lasts.',
        timestamp: '1 hour ago',
        createdAt: '2026-02-28T09:52:00Z',
    },
    {
        id: 'o3',
        type: 'opinion',
        handle: '@PHCitizen',
        text: 'Water treatment plant in D/Line still not functioning. Third week running. Our councillor is nowhere to be found.',
        timestamp: '3 hours ago',
        createdAt: '2026-02-28T07:52:00Z',
    },
    {
        id: 'o4',
        type: 'opinion',
        handle: '@KanoVoice',
        text: 'New school building project in Nassarawa GRA stalled for 6 months. Materials delivered but no workers on site. Where did the funds go?',
        timestamp: '6 hours ago',
        createdAt: '2026-02-28T04:52:00Z',
    },
    {
        id: 'o5',
        type: 'opinion',
        handle: '@IbadanUpdates',
        text: 'The Ring Road traffic light has been out for 2 weeks. 3 accidents already. Simple fix that no one is doing.',
        timestamp: '8 hours ago',
        createdAt: '2026-02-28T02:52:00Z',
    },
    {
        id: 'o6',
        type: 'opinion',
        handle: '@EnnuguReporter',
        text: "Market traders at Ogbete Main Market reporting 200% increase in stall fees with no improvements to infrastructure. Where's the money going?",
        timestamp: '12 hours ago',
        createdAt: '2026-02-27T22:52:00Z',
    },
];
