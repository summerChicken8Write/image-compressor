"use client";

import { useImageCompressor } from "@/hooks/useImageCompressor";
import { Header } from "@/components/Header";
import { ToolPanel } from "@/components/ToolPanel";
import { TaskList } from "@/components/TaskList";
import { Footer } from "@/components/Footer";

export default function Home() {
  const {
    inputRef,
    settings,
    setSettings,
    items,
    isBusy,
    dropActive,
    totals,
    onPick,
    onInputChange,
    removeItem,
    clearAll,
    compressAll,
    downloadZip,
    onDrop,
    setDropActiveState,
  } = useImageCompressor();

  const savings =
    totals.doneCount > 0 && totals.original > 0 && totals.compressed > 0
      ? Math.max(0, 1 - totals.compressed / totals.original)
      : 0;

  return (
    <div className="pixel-bg min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <Header />

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <ToolPanel
            settings={settings}
            setSettings={setSettings}
            itemsCount={items.length}
            isBusy={isBusy}
            totals={totals}
            savings={savings}
            inputRef={inputRef}
            dropActive={dropActive}
            onPick={onPick}
            onInputChange={onInputChange}
            setDropActiveState={setDropActiveState}
            onDrop={onDrop}
            compressAll={compressAll}
            downloadZip={downloadZip}
            clearAll={clearAll}
          />

          <TaskList items={items} isBusy={isBusy} onRemove={removeItem} />
        </div>

        <Footer />
      </div>
    </div>
  );
}
