import type { ApiKeyScope } from "@beerswipe/types";
import type { UserInstance } from "../models/index.ts";

declare global {
  namespace Express {
    interface Request {
      user?: UserInstance;
      apiKey?: {
        id: number;
        name: string;
        scope: ApiKeyScope;
        prefix: string;
        createdBy: number;
      };
    }
  }
}
