'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { SystemSettings } from '@/types/settings';
import { parseOpenWithFiles } from '@/helpers/cli';
import { tauriHandleClose, tauriHandleOnCloseWindow } from '@/utils/window';
import { isTauriAppPlatform } from '@/services/environment';
import { uniqueId } from '@/utils/misc';
import { navigateToLibrary } from '@/utils/nav';
import { BOOK_IDS_SEPARATOR } from '@/services/constants';

import useBooksManager from '../hooks/useBooksManager';
import useBookShortcuts from '../hooks/useBookShortcuts';
import Spinner from '@/components/Spinner';
import SideBar from './sidebar/SideBar';
import Notebook from './notebook/Notebook';
import BooksGrid from './BooksGrid';
import { eventDispatcher } from '@/utils/event';

const ReaderContent: React.FC<{ ids?: string; settings: SystemSettings }> = ({ ids, settings }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { envConfig } = useEnv();
  const { bookKeys, dismissBook, getNextBookKey } = useBooksManager();
  const { sideBarBookKey, setSideBarBookKey } = useSidebarStore();
  const { saveSettings } = useSettingsStore();
  const { getConfig, getBookData, saveConfig } = useBookDataStore();
  const { getView, setBookKeys } = useReaderStore();
  const { initViewState, getViewState, clearViewState } = useReaderStore();
  const isInitiating = useRef(false);
  const [loading, setLoading] = useState(false);

  useBookShortcuts({ sideBarBookKey, bookKeys });

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;

    const bookIds = ids || searchParams?.get('ids') || '';
    const initialIds = bookIds.split(BOOK_IDS_SEPARATOR).filter(Boolean);
    const initialBookKeys = initialIds.map((id) => `${id}-${uniqueId()}`);
    setBookKeys(initialBookKeys);
    const uniqueIds = new Set<string>();
    console.log('Initialize books', initialBookKeys);
    initialBookKeys.forEach((key, index) => {
      const id = key.split('-')[0]!;
      const isPrimary = !uniqueIds.has(id);
      uniqueIds.add(id);
      if (!getViewState(key)) {
        initViewState(envConfig, id, key, isPrimary);
        if (index === 0) setSideBarBookKey(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isTauriAppPlatform()) tauriHandleOnCloseWindow(handleCloseBooks);
    window.addEventListener('beforeunload', handleCloseBooks);
    eventDispatcher.on('quit-app', handleCloseBooks);
    return () => {
      window.removeEventListener('beforeunload', handleCloseBooks);
      eventDispatcher.off('quit-app', handleCloseBooks);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKeys]);

  const saveBookConfig = async (bookKey: string) => {
    const config = getConfig(bookKey);
    const { book } = getBookData(bookKey) || {};
    const { isPrimary } = getViewState(bookKey) || {};
    if (isPrimary && book && config) {
      await saveConfig(envConfig, bookKey, config, settings);
    }
  };

  const saveConfigAndCloseBook = async (bookKey: string) => {
    console.log('Closing book', bookKey);
    getView(bookKey)?.close();
    getView(bookKey)?.remove();
    await saveBookConfig(bookKey);
    clearViewState(bookKey);
  };

  const saveSettingsAndGoToLibrary = () => {
    saveSettings(envConfig, settings);
    navigateToLibrary(router);
  };

  const handleCloseBooks = async () => {
    await Promise.all(bookKeys.map((key) => saveConfigAndCloseBook(key)));
    await saveSettings(envConfig, settings);
  };

  const handleCloseBooksToLibrary = () => {
    handleCloseBooks();
    navigateToLibrary(router);
  };

  const handleCloseBook = async (bookKey: string) => {
    saveConfigAndCloseBook(bookKey);
    if (sideBarBookKey === bookKey) {
      setSideBarBookKey(getNextBookKey(sideBarBookKey));
    }
    dismissBook(bookKey);
    if (bookKeys.filter((key) => key !== bookKey).length == 0) {
      const openWithFiles = (await parseOpenWithFiles()) || [];
      if (openWithFiles.length > 0) {
        tauriHandleClose();
      } else {
        saveSettingsAndGoToLibrary();
      }
    }
  };

  if (!bookKeys || bookKeys.length === 0) return null;
  const bookData = getBookData(bookKeys[0]!);
  if (!bookData || !bookData.book || !bookData.bookDoc) {
    setTimeout(() => setLoading(true), 300);
    return (
      loading && (
        <div className={'hero hero-content min-h-screen'}>
          <Spinner loading={true} />
        </div>
      )
    );
  }

  return (
    <div className='flex h-screen'>
      <SideBar onGoToLibrary={handleCloseBooksToLibrary} />
      <BooksGrid bookKeys={bookKeys} onCloseBook={handleCloseBook} />
      <Notebook />
    </div>
  );
};

export default ReaderContent;
