import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { localizedError, useLocale } from '@nestyk/i18n';
import { MobileIcon, useMobileTheme } from '@nestyk/ui/native';
import { DEFAULT_ROOM_SHARE_VISIBILITY, type RoomShareVisibility } from '../share-completeness';
import type { RoomShareLinkApi, RoomShareLinkSheetProps } from './RoomShareLinkSheet';
import './agent-room-share-dialog.css';

type Link = Awaited<ReturnType<RoomShareLinkApi['list']>>['items'][number];
const sections = ['photos', 'price', 'facilities', 'location'] as const;

function interpolate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(vars[key] ?? match));
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    const input = document.createElement('textarea');
    input.value = url;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    // Keep the fallback in the active dialog's focus scope.
    const host = document.querySelector('dialog.ars-dialog[open]') ?? document.body;
    const focused = document.activeElement;
    host.appendChild(input);
    try {
      input.focus();
      input.select();
      return document.execCommand('copy');
    } finally {
      input.remove();
      if (focused instanceof HTMLElement) focused.focus();
    }
  }
}

/** Agent desktop presentation. Native and narrow web sharing retain RoomShareLinkSheet. */
export function AgentRoomShareDialog({ visible, room, api, onClose, onPreview }: RoomShareLinkSheetProps) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const rd = t.agent.roomDetail;
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [visibility, setVisibility] = useState<RoomShareVisibility>(DEFAULT_ROOM_SHARE_VISIBILITY);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [links, setLinks] = useState<Link[]>([]);
  const [created, setCreated] = useState<{ id: number; url: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (visible && element && !element.open) element.showModal();
    if (!visible && element?.open) element.close();
    return () => { if (element?.open) element.close(); };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setVisibility(DEFAULT_ROOM_SHARE_VISIBILITY);
    setExpiresInDays(7);
    setCreated(null);
    setConfirmId(null);
    setError('');
    setNotice('');
    setLinks([]);
    setLoading(true);
    api.list(room.id).then(result => {
      if (!cancelled) setLinks(result.items);
    }).catch(e => {
      if (!cancelled) setError(localizedError(e, rd.publicShare.loadFailed, locale));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, room.id, api.list, locale, rd.publicShare.loadFailed]);

  const formatDate = (value: string) => new Date(value).toLocaleString(locale === 'th' ? 'th-TH' : locale, {
    dateStyle: 'medium', timeStyle: 'short',
  });
  const shareSections = (): RoomShareVisibility => ({ ...visibility, contact: false });
  const labels = { photos: rd.shareTogglePhotos, price: rd.shareTogglePrice, facilities: rd.shareToggleFacilities, location: rd.shareToggleLocation };
  const statusLabels = { active: rd.shareLinkActive, expired: rd.shareLinkExpired, revoked: rd.shareLinkInactive };

  const onCopy = async (url: string) => {
    setError('');
    setNotice('');
    try {
      if (!await copyLink(url)) throw new Error('Clipboard unavailable');
      setNotice(rd.shareLinkCopied);
    } catch {
      setError(rd.shareLinkCopyFailed);
    }
  };

  const onCreate = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api.create(room.id, { expiresInDays, shareSections: shareSections(), contactId: null });
      setCreated(result);
      await onCopy(result.url);
      setLinks((await api.list(room.id)).items);
    } catch (e) {
      setError(localizedError(e, rd.shareLinkCopyFailed, locale));
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (id: number) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.revoke(room.id, id);
      if (created?.id === id) setCreated(null);
      setConfirmId(null);
      setLinks((await api.list(room.id)).items);
    } catch (e) {
      setError(localizedError(e, rd.shareLinkCopyFailed, locale));
    } finally {
      setBusy(false);
    }
  };

  const content = (
    <dialog
      ref={dialog}
      className="ars-dialog"
      aria-labelledby={titleId}
      style={{
        '--ars-bg': theme.background,
        '--ars-surface': theme.surface,
        '--ars-text': theme.textHeading,
        '--ars-muted': theme.textSecondary,
        '--ars-border': theme.border,
        '--ars-heading-font': locale === 'en' ? 'Baloo2_400Regular' : 'Mitr_500Medium',
      } as React.CSSProperties}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      // Wait for keyup before returning focus: RN Web's parent Modal listens for Escape on document.
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); } }}
      onKeyUp={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <header className="ars-header">
        <div>
          <h2 id={titleId}>{rd.shareManageTitle}</h2>
          <p>{room.promoTitle || room.property?.name || room.listingTitle}</p>
        </div>
        <button type="button" className="ars-close" autoFocus onClick={onClose} aria-label={t.agent.dashboard.webWorkspace.close}>
          <MobileIcon name="close" size={22} color="currentColor" />
        </button>
      </header>
      <div className="ars-body">
        <section className="ars-settings" aria-label={rd.shareExpiryTitle}>
          <fieldset disabled={busy}>
            <legend>{rd.shareExpiryTitle}</legend>
            <div className="ars-expiry">
              {[7, 14, 30].map(days => (
                <label key={days}>
                  <input type="radio" name={`${titleId}-expiry`} value={days} checked={expiresInDays === days} onChange={() => setExpiresInDays(days)} />
                  <span>{interpolate(rd.shareExpiryDays, { days })}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={busy} className="ars-sections">
            <legend>{interpolate(rd.shareCustomerSees, { done: sections.filter(key => visibility[key]).length, total: 4 })}</legend>
            {sections.map(key => (
              <label key={key}>
                <input type="checkbox" name={key} checked={visibility[key]} onChange={() => setVisibility(value => ({ ...value, [key]: !value[key] }))} />
                <span>{labels[key]}</span>
              </label>
            ))}
          </fieldset>
          <div className="ars-private">
            <h3><MobileIcon name="lock" size={16} color="currentColor" />{rd.shareNotSharedTitle}</h3>
            <ul>
              {[rd.shareListingContact, interpolate(rd.listingId, { id: '' }).replace(/[:：]\s*$/, '').trim(), rd.shareNotSharedInternalName, rd.shareNotSharedProvider, rd.shareNotSharedNotes].map(label => <li key={label}>{label}</li>)}
            </ul>
          </div>
        </section>
        <section className="ars-links" aria-label={rd.shareLinksListTitle}>
          {created && (
            <div className="ars-created">
              <span className="ars-status" data-status="active">{rd.shareLinkActive}</span>
              <p>{interpolate(rd.shareLinkExpiresAt, { date: formatDate(created.expiresAt) })}</p>
              <label>
                <span className="ars-sr-only">{rd.shareCopyLink}</span>
                <input className="ars-url" value={created.url} readOnly onFocus={event => event.currentTarget.select()} />
              </label>
              <button type="button" className="ars-button" onClick={() => onCopy(created.url)}>{rd.shareCopyLink}</button>
            </div>
          )}
          <h3>{rd.shareLinksListTitle}</h3>
          {loading ? <p role="status">{t.common.loading}</p> : links.length === 0 ? <p className="ars-empty">{rd.shareLinksEmpty}</p> : (
            <ul className="ars-link-list">
              {links.map(link => (
                <li key={link.id}>
                  <div>
                    <span className="ars-status" data-status={link.status}>{statusLabels[link.status]}</span>
                    <p>{interpolate(rd.shareLinkExpiresAt, { date: formatDate(link.expiresAt) })}</p>
                  </div>
                  {link.status === 'active' && (confirmId === link.id ? (
                    <div className="ars-confirm" role="group" aria-label={rd.shareRevokeConfirm}>
                      <p>{rd.shareRevokeConfirm}</p>
                      <button type="button" className="ars-button" disabled={busy} onClick={() => setConfirmId(null)}>{rd.shareCancel}</button>
                      <button type="button" className="ars-button ars-danger" disabled={busy} onClick={() => onRevoke(link.id)}>{rd.shareDisableLink}</button>
                    </div>
                  ) : <button type="button" className="ars-revoke" disabled={busy} onClick={() => setConfirmId(link.id)}>{rd.shareDisableLink}</button>)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div className="ars-feedback">
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </div>
      <footer className="ars-footer">
        <button type="button" className="ars-button" disabled={busy} onClick={() => { onPreview(shareSections(), null); onClose(); }}>{rd.sharePreviewCta}</button>
        <button type="button" className="ars-button ars-primary" disabled={busy} aria-busy={busy} onClick={onCreate}>{rd.shareCreateLink}</button>
      </footer>
    </dialog>
  );
  // A portal keeps Escape from reaching the containing room detail's capture handler.
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
