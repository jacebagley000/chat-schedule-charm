import { it } from "vitest";
import { routeTree } from "@/routeTree.gen";
it("x", () => { const r:any=routeTree; console.log(Object.keys(r)); console.log(r.children && Object.keys(r.children)); console.log(r.fullPath, r.path, r.id); });
