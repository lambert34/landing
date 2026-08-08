import Link from 'next/link';
import { BrandLogo, Card, Container } from '@g64/ui';

const assets = ['BTC', 'ETH', 'USDT', 'TON', '$G64'];

export default function Home() {
  return (
    <>
      <nav className="topbar">
        <Container className="nav-inner">
          <Link href="/" className="brand-link" aria-label="G64 home">
            <BrandLogo imageSrc="/brand/logo.svg" />
          </Link>
          <div>
            <Link className="nav-link" href="/login">
              Sign in
            </Link>
            <Link className="nav-cta" href="/signup">
              Create account
            </Link>
          </div>
        </Container>
      </nav>

      <main>
        <Container>
          <section className="hero">
            <span className="eyebrow">G64</span>
            <h1>
              Digital assets.
              <br />
              Made simple.
            </h1>
            <p>
              A secure, non-custodial platform
              <br />
              for managing digital assets.
            </p>
            <div className="hero-actions">
              <Link className="nav-cta" href="/signup">
                Create account
              </Link>
              <Link className="text-link" href="/login">
                Sign in <span>→</span>
              </Link>
            </div>
          </section>

          <section className="feature-grid">
            <Card className="assets-card">
              <span className="eyebrow">Your assets</span>
              <div className="asset-marks">
                {assets.map((asset, i) => (
                  <span key={asset} style={{ '--i': i } as React.CSSProperties}>
                    {asset}
                  </span>
                ))}
              </div>
            </Card>
            <Card>
              <div className="feature-number">01</div>
              <h2>You control the keys</h2>
              <p>G64 is designed so your private keys remain under your control.</p>
            </Card>
            <Card>
              <div className="feature-number">02</div>
              <h2>Built for simplicity</h2>
              <p>
                Send. Receive. Swap.
                <br />
                Nothing you don&apos;t need.
              </p>
            </Card>
          </section>
        </Container>
      </main>

      <footer>
        <Container>
          <BrandLogo imageSrc="/brand/logo.svg" className="brand--footer" />
          <p>
            G64 v0.1 is under development and operates with test networks only.
            <br />
            Test assets have no monetary value.
          </p>
          <span>Foundation release · 2026</span>
        </Container>
      </footer>
    </>
  );
}
