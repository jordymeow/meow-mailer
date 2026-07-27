const { useState } = wp.element;
const { __ } = wp.i18n;

import { NekoModal } from '@neko-ui';
import { domain } from '@app/settings';

const useNekoNotice = () => {
  const [notice, setNotice] = useState(null);

  const showNotice = (content, options = {}) => {
    setNotice({
      title: options.title || __( 'Notice', domain ),
      content: content || __( 'An unexpected error occurred.', domain ),
      closeLabel: options.closeLabel || __( 'Close', domain ),
      onClose: typeof options.onClose === 'function' ? options.onClose : null,
    });
  };

  const closeNotice = () => {
    const onClose = notice?.onClose;
    setNotice(null);
    if (onClose) {
      window.setTimeout(onClose, 0);
    }
  };

  return { notice, showNotice, closeNotice };
};

const NekoNoticeModal = ({ notice, onClose }) => (
  <NekoModal
    isOpen={notice !== null}
    onRequestClose={onClose}
    title={notice?.title || __( 'Notice', domain )}
    content={notice?.content || ''}
    okButton={{ label: notice?.closeLabel || __( 'Close', domain ), onClick: onClose }}
  />
);

export { NekoNoticeModal, useNekoNotice };
