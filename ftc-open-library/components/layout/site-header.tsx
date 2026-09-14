import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { MainNav } from "@/components/layout/main-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteLogo } from "@/components/layout/site-logo";
import { SearchBar } from "@/components/search/search-bar";
import { HeaderAuthLinks } from "@/components/layout/header-auth-links";
import { getCurrentAccess } from "@/lib/auth/session";

function NavFallback() {
  return <div className="hidden h-8 w-80 md:block" aria-hidden="true" />;
}

export async function SiteHeader() {
  const access = await getCurrentAccess();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas">
      <Container className="flex h-14 min-w-0 items-center gap-2 sm:gap-4" width="wide">
        <SiteLogo />
        <Suspense fallback={<NavFallback />}>
          <MainNav className="hidden md:flex" />
        </Suspense>
        <div className="ml-auto hidden w-full min-w-0 max-w-xs xl:block">
          <SearchBar id="header-resource-search" />
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Suspense fallback={null}>
            <HeaderAuthLinks access={access} />
          </Suspense>
          <Suspense fallback={null}>
            <MobileNav access={access} />
          </Suspense>
        </div>
      </Container>
    </header>
  );
}
