import React from 'react';
import { Main, Card, CardBody, CardHeader, Badge } from '../components/ui';
import { CryptoHandle } from '../components/auth/CryptoHandle';
import AmnesiaAudit from '../components/profile/AmnesiaAudit';
import { useAuth } from '../contexts/AuthContext';

const Profile: React.FC = () => {
    const { session, reputation, isLoading } = useAuth();

    if (isLoading) {
        return (
            <Main>
                <div className="profile-loading" style={{
                    maxWidth: '640px',
                    margin: '0 auto',
                    textAlign: 'center',
                    padding: 'var(--space-3xl) 0',
                }}>
                    <p className="data-label">Initializing anonymous session...</p>
                </div>
            </Main>
        );
    }

    return (
        <Main>
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                <h1>Profile</h1>
                <p style={{ marginTop: 'var(--space-sm)', marginBottom: 'var(--space-xl)' }}>
                    Your anonymous identity and reputation score.
                </p>

                {/* Identity Card — CryptoHandle component */}
                <Card style={{ marginBottom: 'var(--space-lg)' }}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <span className="data-label">Anonymous Identity</span>
                            <Badge variant="emerald">Active</Badge>
                        </div>
                    </CardHeader>
                    <CardBody>
                        <CryptoHandle editable showDetails />
                    </CardBody>
                </Card>

                {/* Session Info */}
                <Card style={{ marginBottom: 'var(--space-lg)' }}>
                    <CardHeader>
                        <span className="data-label">Session Details</span>
                    </CardHeader>
                    <CardBody>
                        <div style={{
                            fontFamily: 'var(--font-data)',
                            fontSize: '0.8125rem',
                            lineHeight: 2,
                            color: 'var(--text-muted)',
                        }}>
                            <div className="flex items-center justify-between">
                                <span>Token Hash</span>
                                <span className="data-hash" title={session?.anonToken}>
                                    {session?.anonToken
                                        ? `${session.anonToken.slice(0, 8)}...${session.anonToken.slice(-8)}`
                                        : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Created</span>
                                <span>
                                    {session?.createdAt
                                        ? new Date(session.createdAt).toLocaleString()
                                        : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Expires</span>
                                <span>
                                    {session?.expiresAt
                                        ? new Date(session.expiresAt).toLocaleString()
                                        : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Stateless</span>
                                <span style={{ color: 'var(--truth-emerald)' }}>✓ No server storage</span>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* Video Gating Status */}
                <Card style={{ marginBottom: 'var(--space-lg)' }}>
                    <CardHeader>
                        <span className="data-label">Feature Access</span>
                    </CardHeader>
                    <CardBody>
                        <div className="flex items-center justify-between" style={{
                            padding: 'var(--space-sm) 0',
                        }}>
                            <div>
                                <h4 style={{ fontSize: '1rem' }}>Video Upload</h4>
                                <p className="data-label" style={{ marginTop: 'var(--space-xs)' }}>
                                    {reputation?.canUploadVideo
                                        ? 'Unlocked — Advanced Witness'
                                        : `Locked — Need ${(1000 - (reputation?.points ?? 0)).toLocaleString()} more points`}
                                </p>
                            </div>
                            <Badge variant={reputation?.canUploadVideo ? 'emerald' : 'amber'}>
                                {reputation?.canUploadVideo ? 'Unlocked' : 'Locked'}
                            </Badge>
                        </div>
                    </CardBody>
                </Card>

                {/* Amnesia Audit — Digital Terminal Display */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <span className="data-label">Amnesia Audit</span>
                            <Badge variant="emerald">Active</Badge>
                        </div>
                    </CardHeader>
                    <CardBody>
                        <AmnesiaAudit autoScan scanDelay={600} />
                    </CardBody>
                </Card>
            </div>
        </Main>
    );
};

export default Profile;
