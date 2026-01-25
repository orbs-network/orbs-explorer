"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  QueryParamAdapter,
  QueryParamAdapterComponent,
  QueryParamProvider,
} from "use-query-params";

function NextAdapterComponent({
  children,
}: {
  children: (adapter: QueryParamAdapter) => React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const adapter: QueryParamAdapter = {
    replace(location) {
      const search = location.search || "";
      router.replace(`${pathname}${search}`);
    },
    push(location) {
      const search = location.search || "";
      router.push(`${pathname}${search}`);
    },
    get location() {
      return {
        search: searchParams.toString() ? `?${searchParams.toString()}` : "",
      };
    },
  };

  return <>{children(adapter)}</>;
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryParamProvider
      adapter={NextAdapterComponent as QueryParamAdapterComponent}
    >
      {children}
    </QueryParamProvider>
  );
}
