"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationInfo,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type QueryPaginationProps = {
  page: number;
  pageSize: number;
  pageSizeOptions: number[];
  total: number;
  totalPages: number;
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
  selectClassName?: string;
};

export function QueryPagination({
  page,
  pageSize,
  pageSizeOptions,
  total,
  totalPages,
  className,
  leftClassName,
  rightClassName,
  selectClassName
}: QueryPaginationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handlePageSizeChange(value: string) {
    updateParams({
      pageSize: value,
      page: "1"
    });
  }

  function goToPage(nextPage: number) {
    updateParams({
      page: String(nextPage)
    });
  }

  return (
    <div className={className}>
      <div className={leftClassName}>
        <PaginationInfo>共 {total} 条</PaginationInfo>
        <PaginationInfo>每页</PaginationInfo>
        <Select onValueChange={handlePageSizeChange} value={String(pageSize)}>
          <SelectTrigger className={selectClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={rightClassName}>
        <PaginationInfo>
          第 {page} / {totalPages} 页
        </PaginationInfo>
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              {page <= 1 ? (
                <PaginationButton disabled>上一页</PaginationButton>
              ) : (
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    goToPage(Math.max(1, page - 1));
                  }}
                />
              )}
            </PaginationItem>
            <PaginationItem>
              {page >= totalPages ? (
                <PaginationButton disabled>下一页</PaginationButton>
              ) : (
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    goToPage(Math.min(totalPages, page + 1));
                  }}
                />
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
