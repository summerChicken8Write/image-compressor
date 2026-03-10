export function Header() {
  return (
    <header className="mb-8 flex flex-col gap-3">
      <div className="inline-flex items-center gap-3">
        <div
          aria-hidden
          className="h-10 w-10 shrink-0 border-4 border-(--pixel-ink) bg-(--pixel-brick) shadow-[4px_4px_0_0_var(--pixel-ink)]"
        />
        <h1 className="pixel-title text-2xl text-(--pixel-ink) sm:text-3xl">
          像素图片压缩器
        </h1>
      </div>
      <p className="max-w-3xl text-sm leading-6 text-[color-mix(in_oklab,var(--pixel-ink)_70%,transparent)]">
        纯前端压缩：图片不会上传到服务器。支持批量上传，压缩后可单张下载或打包 ZIP 下载。
      </p>
    </header>
  );
}
