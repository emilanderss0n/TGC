import { DependencyContainer } from "tsyringe";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { ImporterUtil } from "@spt/utils/ImporterUtil";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { ITemplateItem, ISlot, ItemType } from "@spt/models/eft/common/tables/ITemplateItem";
import { ICustomizationItem } from "@spt/models/eft/common/tables/ICustomizationItem";


//Item template file
import itemTemplate = require("../templates/item_template.json");
import configJson = require("../config.json");

interface ImodTGCItem {
    item: {
        _id: string;
        _name: string;
        _parent: string;
        _props: {
            [key: string]: any;
        };
        _type: string;
        _proto: string;
    };
    enable: boolean;
    handbook: {
        ParentId: string;
        Price: number;
    };
    locales?: {
        [locale: string]: {
            Name: string;
            ShortName: string;
            Description: string;
        };
    };
    presets?: {
        [preset: string]: string;
    };
}
interface ImodTGCLocale {
    Name: string;
    ShortName?: string;
    Description: string;
}

class TGCItems implements IPostDBLoadMod {
    private db: IDatabaseTables;
    private mydb: any;
    private logger: ILogger;
    private jsonUtil: JsonUtil;

    public postDBLoad(container: DependencyContainer): void {
        this.logger = container.resolve<ILogger>("WinstonLogger");
        this.jsonUtil = container.resolve<JsonUtil>("JsonUtil");

        const databaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const databaseImporter = container.resolve<ImporterUtil>("ImporterUtil");
        const modLoader = container.resolve<PreSptModLoader>("PreSptModLoader");

        //Mod Info
        const modFolderName = "MoxoPixel-TacticalGearComponent";
        const modFullName = "Tactical Gear Component";

        //Trader IDs
        const traders = {
            "PAINTERSHOP": "668aaff35fd574b6dcc4a686"
        };

        //Currency IDs
        const currencies = {
            "roubles": "5449016a4bdc2d6f028b456f",
            "dollars": "5696686a4bdc2da3298b456a",
            "euros": "569668774bdc2da2298b4568",
            "bitcoin": "59faff1d86f7746c51718c9c",
            "gp": "5d235b4d86f7742e017bc88a"
        }

        //Get the server database and our custom database
        this.db = databaseServer.getTables();
        this.mydb = databaseImporter.loadRecursive(`${modLoader.getModPath(modFolderName)}database/`);

        this.logger.info("Loading: " + modFullName);

        const secureContainerIds = [
            "665ee77ccf2d642e98220bca",
            "5857a8bc2459772bad15db29",
            "64f6f4c5911bcdfe8b03b0dc",
            "544a11ac4bdc2d470e8b456a",
            "5857a8b324597729ab0a0e7d",
            "59db794186f77448bc595262",
            "664a55d84a90fc2c8a6305c9",
            "5c093ca986f7740a1867ab12"
        ];
        const armbandId = "55d7217a4bdc2d86028b456d";

        //Items
        for (const [modTGCID, modTGCItem] of Object.entries(this.mydb.modTGC_items)) {
            //Items + Handbook
            if (typeof modTGCItem === 'object' && "clone" in modTGCItem) {
                this.cloneItem(modTGCItem.clone as string, modTGCID);
                this.copyToFilters(modTGCItem.clone as string, modTGCID);


                if ("PutInArmband" in modTGCItem && this.db.templates.items[armbandId]) {
                    this.db.templates.items[armbandId]._props.Slots[14]._props.filters[0].Filter.push(modTGCID);
                }
                if (configJson.PouchesInSecureContainer && "putInSecureContainer" in modTGCItem) {
                    for (const id of secureContainerIds) {
                        const item = this.db.templates.items[id];
                        if (item && item._props && item._props.Grids && item._props.Grids[0] && item._props.Grids[0]._props && item._props.Grids[0]._props.filters && item._props.Grids[0]._props.filters[0] && item._props.Grids[0]._props.filters[0].Filter) {
                            item._props.Grids[0]._props.filters[0].Filter.push(modTGCID);
                        }
                    }
                }
            }
            else this.createItem(modTGCID);

            //Locales (Languages)
            this.addLocales(modTGCID, modTGCItem as ImodTGCItem);
        }

        //Item Filters
        for (const modTGCID in this.mydb.modTGC_items) this.addToFilters(modTGCID);

        //Clothing
        for (const [modTGCID, modTGCArticle] of Object.entries(this.mydb.modTGC_clothes)) {
            //Articles + Handbook
            if (typeof modTGCArticle === 'object' && "clone" in modTGCArticle) {
                this.cloneClothing(modTGCArticle.clone as string, modTGCID);
            }

            //Locales (Languages)
            this.addLocales(modTGCID, undefined, modTGCArticle as ICustomizationItem);
        }

        //Presets
        for (const preset in this.mydb.globals.ItemPresets) this.db.globals.ItemPresets[preset] = this.mydb.globals.ItemPresets[preset];

        //Traders
        for (const trader in traders) {
            this.addTraderSuits(traders[trader]);
            this.addTraderAssort(traders[trader]);
        }

        //Mastery
        const dbMastering = this.db.globals.config.Mastering
        for (const weapon in this.mydb.globals.config.Mastering) dbMastering.push(this.mydb.globals.config.Mastering[weapon]);
        for (const weapon in dbMastering) {
        }
    }

    private cloneItem(itemToClone: string, modTGCID: string): void {
        //If the item is enabled in the json
        if (this.mydb.modTGC_items[modTGCID].enable == true) {
            //Get a clone of the original item from the database
            let modTGCItemOut = this.jsonUtil.clone(this.db.templates.items[itemToClone]);

            //Change the necessary item attributes using the info in our database file modTGC_items.json
            modTGCItemOut._id = modTGCID;
            modTGCItemOut = this.compareAndReplace(modTGCItemOut, this.mydb.modTGC_items[modTGCID]["item"]);

            //Add the new item to the database
            this.db.templates.items[modTGCID] = modTGCItemOut;

            //Create the handbook entry for the items
            const handbookEntry = {
                "Id": modTGCID,
                "ParentId": this.mydb.modTGC_items[modTGCID]["handbook"]["ParentId"],
                "Price": this.mydb.modTGC_items[modTGCID]["handbook"]["Price"]
            };

            //Add the handbook entry to the database
            this.db.templates.handbook.Items.push(handbookEntry);
        }
    }

    private createItem(itemToCreate: string): void {
        //Create an item from scratch instead of cloning it
        //Requires properly formatted entry in modTGC_items.json with NO "clone" attribute

        //Get the new item object from the json
        const newItem = this.mydb.modTGC_items[itemToCreate];

        //If the item is enabled in the json
        if (newItem.enable) {
            //Check the structure of the new item in modTGC_items
            const [pass, checkedItem] = this.checkItem(newItem);
            if (!pass) return;

            //Add the new item to the database
            this.db.templates.items[itemToCreate] = checkedItem;
            this.logger.debug("Item " + itemToCreate + " created and added to database.");

            //Create the handbook entry for the items
            const handbookEntry = {
                "Id": itemToCreate,
                "ParentId": newItem["handbook"]["ParentId"],
                "Price": newItem["handbook"]["Price"]
            };

            //Add the handbook entry to the database
            this.db.templates.handbook.Items.push(handbookEntry);
            this.logger.debug("Item " + itemToCreate + " added to handbook with price " + handbookEntry.Price);
        }
    }

    private checkItem(itemToCheck: ImodTGCItem): [boolean, ITemplateItem] {
        let pass = true;

        for (const level1 in itemTemplate) {
            if (itemTemplate.hasOwnProperty(level1) && !(level1 in itemToCheck.item)) {
                this.logger.error("ERROR - Missing attribute: \"" + level1 + "\" in your item entry!");
                pass = false;
            }
        }

        for (const prop in itemToCheck.item._props) {
            if (itemToCheck.item._props.hasOwnProperty(prop) && !(prop in itemTemplate._props)) {
                this.logger.warning("WARNING - Attribute: \"" + prop + "\" not found in item template!");
            }
        }

        const itemOUT: ITemplateItem = {
            "_id": itemToCheck.item._id,
            "_name": itemToCheck.item._name,
            "_parent": itemToCheck.item._parent,
            "_props": itemToCheck.item._props,
            "_type": itemToCheck.item._type as ItemType,
            "_proto": itemToCheck.item._proto
        };

        return [pass, itemOUT];
    }

    private compareAndReplace(originalItem, attributesToChange) {
        for (const key in attributesToChange) {
            if (attributesToChange.hasOwnProperty(key)) {
                if ((["boolean", "string", "number"].includes(typeof attributesToChange[key])) || Array.isArray(attributesToChange[key])) {
                    if (key in originalItem) {
                        originalItem[key] = attributesToChange[key];
                    } else {
                        this.logger.warning("(Item: " + originalItem._id + ") WARNING: Could not find the attribute: \"" + key + "\" in the original item, make sure this is intended!");
                        originalItem[key] = attributesToChange[key];
                    }
                } else {
                    originalItem[key] = this.compareAndReplace(originalItem[key], attributesToChange[key]);
                }
            }
        }

        return originalItem;
    }

    private getFilters(item: string): [Array<ISlot>, Array<string>] {
        //Get the slots, chambers, cartridges, and conflicting items objects and return them.

        const slots = (typeof this.db.templates.items[item]._props.Slots === "undefined") ? [] : this.db.templates.items[item]._props.Slots;
        const chambers = (typeof this.db.templates.items[item]._props.Chambers === "undefined") ? [] : this.db.templates.items[item]._props.Chambers;
        const cartridges = (typeof this.db.templates.items[item]._props.Cartridges === "undefined") ? [] : this.db.templates.items[item]._props.Cartridges;
        const filters = slots.concat(chambers, cartridges);

        const conflictingItems = (typeof this.db.templates.items[item]._props.ConflictingItems === "undefined") ? [] : this.db.templates.items[item]._props.ConflictingItems;

        return [filters, conflictingItems];
    }

    private copyToFilters(itemClone: string, modTGCID: string): void {
        //Find the original item in all compatible and conflict filters and add the clone to those filters as well

        for (const item in this.db.templates.items) {
            if (item in this.mydb.modTGC_items) continue;

            const [filters, conflictingItems] = this.getFilters(item);

            for (const filter of filters) {
                for (const id of filter._props.filters[0].Filter) {
                    if (id === itemClone) filter._props.filters[0].Filter.push(modTGCID);
                }
            }

            for (const conflictID of conflictingItems) if (conflictID === itemClone) conflictingItems.push(modTGCID);
        }
    }

    private addToFilters(modTGCID: string): void {
        //Add a new item to compatibility & conflict filters of pre-existing items
        //Add additional compatible and conflicting items to new item filters (manually adding more than the ones that were cloned)

        const modTGCNewItem = this.mydb.modTGC_items[modTGCID];

        //If the item is enabled in the json
        if (modTGCNewItem.enable) {
            this.logger.debug("addToFilters: " + modTGCID);

            //Manually add items into an THISMOD item's filters
            if ("addToThisItemsFilters" in modTGCNewItem) {
                const modTGCItemFilters = this.getFilters(modTGCID)[0];
                let modTGCConflictingItems = this.getFilters(modTGCID)[1];

                for (const modSlotName in modTGCNewItem.addToThisItemsFilters) {
                    if (modSlotName === "conflicts") modTGCConflictingItems = modTGCConflictingItems.concat(modTGCNewItem.addToThisItemsFilters.conflicts)
                    else {
                        for (const filter in modTGCItemFilters) {
                            if (modSlotName === modTGCItemFilters[filter]._name) {
                                const slotFilter = modTGCItemFilters[filter]._props.filters[0].Filter;
                                const newFilter = slotFilter.concat(modTGCNewItem.addToThisItemsFilters[modSlotName])

                                modTGCItemFilters[filter]._props.filters[0].Filter = newFilter;
                            }
                        }
                    }
                }
            }

            //Manually add THISMOD items to pre-existing item filters.
            if ("addToExistingItemFilters" in modTGCNewItem) {
                for (const modSlotName in modTGCNewItem.addToExistingItemFilters) {
                    if (modSlotName === "conflicts") {
                        for (const conflictingItem of modTGCNewItem.addToExistingItemFilters[modSlotName]) {
                            const conflictingItems = this.getFilters(conflictingItem)[1];
                            conflictingItems.push(modTGCID);
                        }
                    }
                    else {
                        for (const compatibleItem of modTGCNewItem.addToExistingItemFilters[modSlotName]) {
                            const filters = this.getFilters(compatibleItem)[0];

                            for (const filter of filters) {
                                if (modSlotName === filter._name) filter._props.filters[0].Filter.push(modTGCID);
                            }
                        }
                    }
                }
            }
        }
    }

    private cloneClothing(itemToClone: string, modTGCID: string): void {
        if (this.mydb.modTGC_clothes[modTGCID].enable || !("enable" in this.mydb.modTGC_clothes[modTGCID])) {
            //Get a clone of the original item from the database
            let tgcClothingOut = this.jsonUtil.clone(this.db.templates.customization[itemToClone]);

            //Change the necessary clothing item attributes using the info in our database file modTGC_clothes.json
            tgcClothingOut._id = modTGCID;
            tgcClothingOut._name = modTGCID;
            tgcClothingOut = this.compareAndReplace(tgcClothingOut, this.mydb.modTGC_clothes[modTGCID]["customization"]);

            //Add the new item to the database
            this.db.templates.customization[modTGCID] = tgcClothingOut;
            this.logger.debug("Clothing item " + modTGCID + " created as a clone of " + itemToClone + " and added to database.");
        }
    }

    private addTraderAssort(trader: string): void {
        //Items
        for (const item in this.mydb.traders[trader].assort.items) {
            this.db.traders[trader].assort.items.push(this.mydb.traders[trader].assort.items[item]);
        }

        //Barter Scheme
        for (const item in this.mydb.traders[trader].assort.barter_scheme) {
            this.db.traders[trader].assort.barter_scheme[item] = this.mydb.traders[trader].assort.barter_scheme[item];
        }

        //Loyalty Levels
        for (const item in this.mydb.traders[trader].assort.loyal_level_items) {
            this.db.traders[trader].assort.loyal_level_items[item] = this.mydb.traders[trader].assort.loyal_level_items[item];
        }
    }

    private addTraderSuits(trader: string): void {
        //Only do anything if a suits.json file is included for trader in this mod
        if (typeof this.mydb.traders[trader].suits !== "undefined") {
            //Enable customization for that trader
            this.db.traders[trader].base.customization_seller = true;

            //Create the suits array if it doesn't already exist in SPT database so we can push to it
            if (typeof this.db.traders[trader].suits === "undefined") this.db.traders[trader].suits = [];

            //Push all suits
            for (const suit of this.mydb.traders[trader].suits) this.db.traders[trader].suits.push(suit);
        }
    }

    private addLocales(modTGCID: string, modTGCItem?: ImodTGCItem, modTGCArticle?: ICustomizationItem): void {
        const name = modTGCID + " Name";
        const shortname = modTGCID + " ShortName";
        const description = modTGCID + " Description";

        const isItem = typeof modTGCItem !== "undefined";
        const modTGCEntry = isItem ? modTGCItem : modTGCArticle;

        for (const localeID in this.db.locales.global) //For each possible locale/language in SPT's database
        {
            let localeEntry: ImodTGCLocale;

            if (isItem && "locales" in modTGCEntry) {
                if (localeID in (modTGCEntry as ImodTGCItem).locales) //If the language is entered in modTGC_items, use that
                {
                    localeEntry = {
                        "Name": (modTGCEntry as ImodTGCItem).locales[localeID].Name,
                        "ShortName": (modTGCEntry as ImodTGCItem).locales[localeID].ShortName,
                        "Description": (modTGCEntry as ImodTGCItem).locales[localeID].Description
                    }
                }
                else //Otherwise use english as the default
                {
                    localeEntry = {
                        "Name": (modTGCEntry as ImodTGCItem).locales.en.Name,
                        "ShortName": (modTGCEntry as ImodTGCItem).locales.en.ShortName,
                        "Description": (modTGCEntry as ImodTGCItem).locales.en.Description
                    }
                }
                this.db.locales.global[localeID][name] = localeEntry.Name;
                this.db.locales.global[localeID][shortname] = localeEntry.ShortName;
                this.db.locales.global[localeID][description] = localeEntry.Description;

            } else if (!isItem && "locales" in modTGCEntry) {
                const locales = (modTGCEntry as any).locales;
                if (localeID in locales) {
                    localeEntry = {
                        "Name": locales[localeID].Name,
                        "Description": locales[localeID].Description || ""
                    };
                } else {
                    localeEntry = {
                        "Name": locales.en.Name,
                        "Description": locales.en.Description || ""
                    };
                }
                this.db.locales.global[localeID][name] = localeEntry.Name;
                this.db.locales.global[localeID][description] = localeEntry.Description;
            } else {
                if (isItem) this.logger.warning("WARNING: Missing locale entry for item: " + modTGCID);
                else this.logger.debug("No locale entries for item/clothing: " + modTGCID);
            }

            //Also add the necessary preset locale entries if they exist
            if (isItem && modTGCItem.presets) {
                for (const preset in modTGCItem.presets) {
                    this.db.locales.global[localeID][preset] = modTGCItem.presets[preset];
                }
            }
        }
    }
}

module.exports = { mod: new TGCItems() }