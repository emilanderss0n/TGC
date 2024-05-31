import { DependencyContainer }      from "tsyringe";
import { IPostDBLoadMod }           from "@spt-aki/models/external/IPostDBLoadMod";
import { DatabaseServer }           from "@spt-aki/servers/DatabaseServer";
import { ImporterUtil }             from "@spt-aki/utils/ImporterUtil";
import { ILogger }                  from "@spt-aki/models/spt/utils/ILogger";
import { PreAkiModLoader }          from "@spt-aki/loaders/PreAkiModLoader";
import { IDatabaseTables }          from "@spt-aki/models/spt/server/IDatabaseTables";
import { JsonUtil }                 from "@spt-aki/utils/JsonUtil"
import { ITemplateItem, Slot }      from "@spt-aki/models/eft/common/tables/ITemplateItem";
import { ICustomizationItem }       from "@spt-aki/models/eft/common/tables/ICustomizationItem";
import { ImodTGCDatabase }           from "@spt-aki/modTGC/ImodTGCDatabase";
import { ImodTGCItem, ImodTGCLocale } from "@spt-aki/modTGC/ImodTGCItem";
import { ImodTGCCustomizationItem }  from "@spt-aki/modTGC/ImodTGCCustomizationItem";


//Item template file
import itemTemplate =       require("../templates/item_template.json");


class TGCItems implements IPostDBLoadMod
{
    private db:         IDatabaseTables;
    private mydb:       ImodTGCDatabase;    
    private logger:     ILogger;
    private jsonUtil:   JsonUtil;

    public postDBLoad(container: DependencyContainer): void
    {
        this.logger =               container.resolve<ILogger>("WinstonLogger");
        this.jsonUtil =             container.resolve<JsonUtil>("JsonUtil");

        const databaseServer =      container.resolve<DatabaseServer>("DatabaseServer");
        const databaseImporter =    container.resolve<ImporterUtil>("ImporterUtil");
        const modLoader =           container.resolve<PreAkiModLoader>("PreAkiModLoader");

        //Mod Info
        const modFolderName =   "MoxoPixel-TacticalGearComponent";
        const modFullName =     "Tactical Gear Component";

        //Trader IDs
        const traders = {
            "PAINTERSHOP":     "PAINTERSHOP"
        };

        //Currency IDs
        const currencies = {
            "roubles":  "5449016a4bdc2d6f028b456f",
            "dollars":  "5696686a4bdc2da3298b456a",
            "euros":    "569668774bdc2da2298b4568"
        }

        //Get the server database and our custom database
        this.db = databaseServer.getTables();
        this.mydb = databaseImporter.loadRecursive(`${modLoader.getModPath(modFolderName)}database/`);

        this.logger.info("Loading: " + modFullName);

        //Items
        for (const [modTGCID, modTGCItem] of Object.entries(this.mydb.modTGC_items))
        {
            //Items + Handbook
            if ( "clone" in modTGCItem )
            {
                this.cloneItem(modTGCItem.clone, modTGCID);
                this.copyToFilters(modTGCItem.clone, modTGCID);
                if ( "PutInArmband" in modTGCItem) {
                    this.db.templates.items["55d7217a4bdc2d86028b456d"]._props.Slots[14]._props.filters[0].Filter.push(modTGCID);
                }
            }
            else this.createItem(modTGCID);

            //Locales (Languages)
            this.addLocales(modTGCID, modTGCItem);
        }
        
        //Item Filters
        for (const modTGCID in this.mydb.modTGC_items) this.addToFilters(modTGCID);

        //Clothing
        for (const [modTGCID, modTGCArticle] of Object.entries(this.mydb.modTGC_clothes))
        {
            //Articles + Handbook
            if ( "clone" in modTGCArticle )
            {
                this.cloneClothing(modTGCArticle.clone, modTGCID);
            }

            //Locales (Languages)
            this.addLocales(modTGCID, undefined, modTGCArticle);
        }

        //Presets
        for (const preset in this.mydb.globals.ItemPresets) this.db.globals.ItemPresets[preset] = this.mydb.globals.ItemPresets[preset];

        //Traders
        for (const trader in traders)
        {
            this.addTraderSuits(traders[trader]);
            this.addTraderAssort(traders[trader]);
        }

        //Mastery
        const dbMastering = this.db.globals.config.Mastering
        for (const weapon in this.mydb.globals.config.Mastering) dbMastering.push(this.mydb.globals.config.Mastering[weapon]);
        for (const weapon in dbMastering) 
        {
        }
    }

    private cloneItem(itemToClone: string, modTGCID: string): void
    {
        //If the item is enabled in the json
        if ( this.mydb.modTGC_items[modTGCID].enable == true )
        {
            //Get a clone of the original item from the database
            let modTGCItemOut = this.jsonUtil.clone(this.db.templates.items[itemToClone]);

            //Change the necessary item attributes using the info in our database file modTGC_items.json
            modTGCItemOut._id = modTGCID;
            modTGCItemOut = this.compareAndReplace(modTGCItemOut, this.mydb.modTGC_items[modTGCID]["item"]);

            //Add the new item to the database
            this.db.templates.items[modTGCID] = modTGCItemOut;
            this.logger.debug("Item " + modTGCID + " created as a clone of " + itemToClone + " and added to database.");

            //Create the handbook entry for the items
            const handbookEntry = {
                "Id": modTGCID,
                "ParentId": this.mydb.modTGC_items[modTGCID]["handbook"]["ParentId"],
                "Price": this.mydb.modTGC_items[modTGCID]["handbook"]["Price"]
            };

            //Add the handbook entry to the database
            this.db.templates.handbook.Items.push(handbookEntry);
            this.logger.debug("Item " + modTGCID + " added to handbook with price " + handbookEntry.Price);
        }
    }

    private createItem(itemToCreate: string): void
    {
        //Create an item from scratch instead of cloning it
        //Requires properly formatted entry in modTGC_items.json with NO "clone" attribute

        //Get the new item object from the json
        const newItem = this.mydb.modTGC_items[itemToCreate];

        //If the item is enabled in the json
        if ( newItem.enable )
        {
            //Check the structure of the new item in modTGC_items
            const [pass, checkedItem] = this.checkItem(newItem);
            if ( !pass ) return;

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

    private checkItem(itemToCheck: ImodTGCItem): [boolean, ITemplateItem]
    {
        //A very basic top-level check of an item to make sure it has the proper attributes
        //Also convert to ITemplateItem to avoid errors

        let pass = true;

        //First make sure it has the top-level 5 entries needed for an item
        for (const level1 in itemTemplate )
        {
            if ( !(level1 in itemToCheck.item) )
            {
                this.logger.error("ERROR - Missing attribute: \"" + level1 + "\" in your item entry!");
                pass = false;
            }
        }

        //Then make sure the attributes in _props exist in the item template, warn user if not.
        for (const prop in itemToCheck.item._props)
        {
            if ( !(prop in itemTemplate._props) ) this.logger.warning("WARNING - Attribute: \"" + prop + "\" not found in item template!");
        }

        const itemOUT: ITemplateItem = {
            "_id":      itemToCheck.item._id,
            "_name":    itemToCheck.item._name,
            "_parent":  itemToCheck.item._parent,
            "_props":   itemToCheck.item._props,
            "_type":    itemToCheck.item._type,
            "_proto":   itemToCheck.item._proto
        };

        return [pass, itemOUT];
    }

    private compareAndReplace(originalItem, attributesToChange)
    {
        //Recursive function to find attributes in the original item/clothing object and change them.
        //This is done so each attribute does not have to be manually changed and can instead be read from properly formatted json
        //Requires the attributes to be in the same nested object format as the item entry in order to work (see modTGC_items.json and items.json in SPT install)

        for (const key in attributesToChange)
        {
            //If you've reached the end of a nested series, try to change the value in original to new
            if ( (["boolean", "string", "number"].includes(typeof attributesToChange[key])) || Array.isArray(attributesToChange[key]) )
            {
                if ( key in originalItem ) originalItem[key] = attributesToChange[key];
                //TO DO: Add check with item template here if someone wants to add new properties to a cloned item.
                else 
                {
                    this.logger.warning("(Item: " + originalItem._id + ") WARNING: Could not find the attribute: \"" + key + "\" in the original item, make sure this is intended!");
                    originalItem[key] = attributesToChange[key];
                }
            }

            //Otherwise keep traveling down the nest
            else originalItem[key] = this.compareAndReplace(originalItem[key], attributesToChange[key]);
        }

        return originalItem;
    }

    private getFilters(item: string): [Array<Slot>, Array<string>]
    {
        //Get the slots, chambers, cartridges, and conflicting items objects and return them.

        const slots = (typeof this.db.templates.items[item]._props.Slots === "undefined")            ? [] : this.db.templates.items[item]._props.Slots;
        const chambers = (typeof this.db.templates.items[item]._props.Chambers === "undefined")      ? [] : this.db.templates.items[item]._props.Chambers;
        const cartridges = (typeof this.db.templates.items[item]._props.Cartridges === "undefined")  ? [] : this.db.templates.items[item]._props.Cartridges;
        const filters = slots.concat(chambers, cartridges);

        const conflictingItems =  (typeof this.db.templates.items[item]._props.ConflictingItems === "undefined") ? [] : this.db.templates.items[item]._props.ConflictingItems;

        return [filters, conflictingItems];
    }

    private copyToFilters(itemClone: string, modTGCID: string): void
    {
        //Find the original item in all compatible and conflict filters and add the clone to those filters as well

        for (const item in this.db.templates.items)
        {
            if ( item in this.mydb.modTGC_items ) continue;
            
            const [filters, conflictingItems] = this.getFilters(item);

            for (const filter of filters)
            {
                for (const id of filter._props.filters[0].Filter)
                {
                    if ( id === itemClone ) filter._props.filters[0].Filter.push(modTGCID);
                }
            }

            for (const conflictID of conflictingItems) if ( conflictID === itemClone ) conflictingItems.push(modTGCID);
        }
    }

    private addToFilters(modTGCID: string): void
    {
        //Add a new item to compatibility & conflict filters of pre-existing items
        //Add additional compatible and conflicting items to new item filters (manually adding more than the ones that were cloned)

        const modTGCNewItem = this.mydb.modTGC_items[modTGCID];

        //If the item is enabled in the json
        if (modTGCNewItem.enable)
        {
            this.logger.debug("addToFilters: " + modTGCID);

            //Manually add items into an THISMOD item's filters
            if ( "addToThisItemsFilters" in modTGCNewItem )
            {
                const   modTGCItemFilters =      this.getFilters(modTGCID)[0];
                let     modTGCConflictingItems = this.getFilters(modTGCID)[1];
    
                for (const modSlotName in modTGCNewItem.addToThisItemsFilters)
                {
                    if ( modSlotName === "conflicts" ) modTGCConflictingItems = modTGCConflictingItems.concat(modTGCNewItem.addToThisItemsFilters.conflicts)
                    else
                    {
                        for (const filter in modTGCItemFilters)
                        {
                            if ( modSlotName === modTGCItemFilters[filter]._name )
                            {
                                const slotFilter = modTGCItemFilters[filter]._props.filters[0].Filter;
                                const newFilter = slotFilter.concat(modTGCNewItem.addToThisItemsFilters[modSlotName])

                                modTGCItemFilters[filter]._props.filters[0].Filter = newFilter;
                            }
                        }
                    }
                }
            }
    
            //Manually add THISMOD items to pre-existing item filters.
            if ( "addToExistingItemFilters" in modTGCNewItem )
            {
                for (const modSlotName in modTGCNewItem.addToExistingItemFilters)
                {
                    if ( modSlotName === "conflicts" )
                    {
                        for (const conflictingItem of modTGCNewItem.addToExistingItemFilters[modSlotName])
                        {
                            const conflictingItems = this.getFilters(conflictingItem)[1];
                            conflictingItems.push(modTGCID);
                        }
                    }
                    else
                    {
                        for (const compatibleItem of modTGCNewItem.addToExistingItemFilters[modSlotName])
                        {
                            const filters = this.getFilters(compatibleItem)[0];
        
                            for (const filter of filters)
                            {
                                if ( modSlotName === filter._name ) filter._props.filters[0].Filter.push(modTGCID);
                            }
                        }
                    }
                }
            }
        }
    }

    private cloneClothing(itemToClone: string, modTGCID: string): void
    {
        if ( this.mydb.modTGC_clothes[modTGCID].enable || !("enable" in this.mydb.modTGC_clothes[modTGCID]) )
        {
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

    private addTraderAssort(trader: string): void 
    {
        //Items
        for (const item in this.mydb.traders[trader].assort.items) 
        {
            this.db.traders[trader].assort.items.push(this.mydb.traders[trader].assort.items[item]);
        }

        //Barter Scheme
        for (const item in this.mydb.traders[trader].assort.barter_scheme) 
        {
            this.db.traders[trader].assort.barter_scheme[item] = this.mydb.traders[trader].assort.barter_scheme[item];
        }

        //Loyalty Levels
        for (const item in this.mydb.traders[trader].assort.loyal_level_items) 
        {
            this.db.traders[trader].assort.loyal_level_items[item] = this.mydb.traders[trader].assort.loyal_level_items[item];
        }
    }

    private addTraderSuits(trader: string): void
    {
        //Only do anything if a suits.json file is included for trader in this mod
        if ( typeof this.mydb.traders[trader].suits !== "undefined" )
        {
            //Enable customization for that trader
            this.db.traders[trader].base.customization_seller = true;

            //Create the suits array if it doesn't already exist in SPT database so we can push to it
            if ( typeof this.db.traders[trader].suits === "undefined" ) this.db.traders[trader].suits = [];

            //Push all suits
            for (const suit of this.mydb.traders[trader].suits) this.db.traders[trader].suits.push(suit);
        }
    }

    private addLocales(modTGCID: string, modTGCItem?: ImodTGCItem, modTGCArticle?: ImodTGCCustomizationItem): void
    {
        const name =            modTGCID + " Name";
        const shortname =       modTGCID + " ShortName";
        const description =     modTGCID + " Description";

        const isItem = typeof modTGCItem !== "undefined"
        const modTGCEntry = isItem ? modTGCItem : modTGCArticle;

        for (const localeID in this.db.locales.global) //For each possible locale/language in SPT's database
        {
            let localeEntry: ImodTGCLocale;

            if ( modTGCEntry.locales )
            {
                if ( localeID in modTGCEntry.locales) //If the language is entered in modTGC_items, use that
                {
                    localeEntry = {
                        "Name":           modTGCEntry.locales[localeID].Name,
                        "ShortName":      modTGCEntry.locales[localeID].ShortName,
                        "Description":    modTGCEntry.locales[localeID].Description
                    }
                }
                else //Otherwise use english as the default
                {
                    localeEntry = {
                        "Name":           modTGCEntry.locales.en.Name,
                        "ShortName":      modTGCEntry.locales.en.ShortName,
                        "Description":    modTGCEntry.locales.en.Description
                    }
                }
                this.db.locales.global[localeID][name] =            localeEntry.Name;
                this.db.locales.global[localeID][shortname] =       localeEntry.ShortName;
                this.db.locales.global[localeID][description] =     localeEntry.Description;
                
            }

            else 
            {
                if ( isItem ) this.logger.warning("WARNING: Missing locale entry for item: " + modTGCID);
                else this.logger.debug("No locale entries for item/clothing: " + modTGCID)
            }

            //Also add the necessary preset locale entries if they exist
            if ( isItem && modTGCItem.presets )
            {
                for (const preset in modTGCItem.presets)
                {
                    this.db.locales.global[localeID][preset] = modTGCItem.presets[preset];
                }
            }
        }
    }
}

module.exports = { mod: new TGCItems() }