// One action per line: a title, what it does, and the control that does it on the
// right. Shared by the blocks that are lists of things to do rather than settings.
const SettingRow = ({ title, description, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--neko-gray-50)', lineHeight: 1.4 }}>{description}</div>
    </div>
    {children ? <div style={{ flex: '0 0 auto' }}>{children}</div> : null}
  </div>
);

export default SettingRow;
