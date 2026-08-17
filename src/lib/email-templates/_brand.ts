// Shared inline styles for poŻeramy auth emails.
// Body background MUST stay #ffffff for client compatibility.
export const brand = {
  main: {
    backgroundColor: '#ffffff',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
    margin: 0,
    padding: 0,
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '32px 28px 40px',
  },
  brandBar: {
    fontSize: '24px',
    fontWeight: 800 as const,
    letterSpacing: '-0.02em',
    color: '#0F172A',
    margin: '0 0 28px',
  },
  brandAccent: {
    color: '#E63946',
  },
  h1: {
    fontSize: '26px',
    fontWeight: 800 as const,
    color: '#0F172A',
    lineHeight: 1.2,
    margin: '0 0 16px',
  },
  text: {
    fontSize: '15px',
    color: '#334155',
    lineHeight: 1.6,
    margin: '0 0 20px',
  },
  button: {
    backgroundColor: '#E63946',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 700 as const,
    borderRadius: '999px',
    padding: '14px 28px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  card: {
    backgroundColor: '#FDF6EE',
    borderRadius: '16px',
    padding: '24px',
    margin: '8px 0 24px',
    textAlign: 'center' as const,
  },
  code: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: '28px',
    fontWeight: 800 as const,
    letterSpacing: '0.3em',
    color: '#0F172A',
    margin: '0',
  },
  link: { color: '#E63946', textDecoration: 'underline' },
  hr: {
    border: 'none',
    borderTop: '1px solid #E2E8F0',
    margin: '32px 0 20px',
  },
  footer: {
    fontSize: '12px',
    color: '#94A3B8',
    lineHeight: 1.5,
    margin: 0,
  },
}
