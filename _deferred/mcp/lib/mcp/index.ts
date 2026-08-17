import { defineMcp } from "@lovable.dev/mcp-js";
import searchPlaces from "./tools/search_places";
import getPlace from "./tools/get_place";
import listCuisines from "./tools/list_cuisines";

export default defineMcp({
  name: "pozeramy-mcp",
  title: "poŻeramy",
  version: "0.1.0",
  instructions:
    "Tools for the poŻeramy restaurant guide (pozeramy.live). Use `list_cuisines` to discover cuisine tags, `search_places` to find restaurants by name, cuisine, district, or address, and `get_place` to fetch full details for a specific restaurant slug.",
  tools: [searchPlaces, getPlace, listCuisines],
});
