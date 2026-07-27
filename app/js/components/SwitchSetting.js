import { NekoSettings, NekoSwitch } from '@neko-ui';

/**
 * NekoSwitch has no `description` prop. Unlike NekoInput and NekoSelect, it
 * drops one silently onto the DOM. Until the library grows one, render it here
 * so a toggle can explain itself like every other control does.
 */
const SwitchSetting = ({ title, name, checked, onChange, description }) => (
  <NekoSettings title={title}>
    <NekoSwitch name={name} checked={!!checked} onChange={onChange} onValue={true} offValue={false} />
    {description && (
      <p style={{
        fontSize: 'var(--neko-small-font-size)', color: 'var(--neko-gray-60)',
        lineHeight: '14px', marginTop: 5, marginBottom: 0,
      }}>{description}</p>
    )}
  </NekoSettings>
);

export default SwitchSetting;
