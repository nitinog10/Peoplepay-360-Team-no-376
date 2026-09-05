import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type { ListQuery, ManagedUser, Paginated, Role, RoleName } from "./types";

export type ListUsersQuery = ListQuery & {
  role?: RoleName;
  isActive?: boolean;
};

export interface CreateUserBody {
  employeeId: number;
  username: string;
  password: string;
  role: RoleName;
}

export interface UpdateUserBody {
  username?: string;
  password?: string;
  role?: RoleName;
  isActive?: boolean;
}

export const userKeys = {
  all: ["users"] as const,
  list: (query: ListUsersQuery) => ["users", "list", query] as const,
  detail: (id: number) => ["users", "detail", id] as const,
};

export const roleKeys = {
  all: ["roles"] as const,
};

export const users = {
  list: (query: ListUsersQuery = {}) =>
    queryOptions({
      queryKey: userKeys.list(query),
      queryFn: ({ signal }) => http.get<Paginated<ManagedUser>>("/users", { query, signal }),
    }),

  detail: (id: number) =>
    queryOptions({
      queryKey: userKeys.detail(id),
      queryFn: ({ signal }) => http.get<ManagedUser>(`/users/${id}`, { signal }),
    }),

  roles: () =>
    queryOptions({
      queryKey: roleKeys.all,
      queryFn: ({ signal }) => http.get<{ data: Role[] }>("/roles", { signal }),
      staleTime: Infinity,
    }),

  create: (body: CreateUserBody) => http.post<ManagedUser>("/users", body),

  update: (id: number, body: UpdateUserBody) =>
    http.patch<ManagedUser>(`/users/${id}`, body),
};
