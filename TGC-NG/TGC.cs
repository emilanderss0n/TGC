using System.Reflection;
using System.Text.Json;
using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.DI;
using SPTarkov.Server.Core.Helpers;
using SPTarkov.Server.Core.Models.Spt.Mod;
using SPTarkov.Server.Core.Models.Utils;
using SPTarkov.Server.Core.Services;
using SPTarkov.Server.Core.Models.Common;
using SPTarkov.Server.Core.Models.Eft.Common;
using SPTarkov.Server.Core.Models.Eft.Common.Tables;
using SPTarkov.Server.Core.Utils.Json;
using TGC.Models;
using Range = SemanticVersioning.Range;

namespace TGC;

public record ModMetadata : AbstractModMetadata
{
    public override string ModGuid { get; init; } = "com.emilanderss0n.tgc";
    public override string Name { get; init; } = "Tactical Gear Component";
    public override string Author { get; init; } = "MonoPixel";
    public override List<string>? Contributors { get; init; }
    public override SemanticVersioning.Version Version { get; init; } = new("2.0.0");
    public override SemanticVersioning.Range SptVersion { get; init; } = new("~4.0.0");
    public override List<string>? Incompatibilities { get; init; }
    public override Dictionary<string, SemanticVersioning.Range>? ModDependencies { get; init; } = new()
    {
        { "com.wtt.commonlib", new Range("~2.0.0") }
    };
    public override string? Url { get; init; } = "";
    public override bool? IsBundleMod { get; init; } = true;
    public override string? License { get; init; } = "MIT";
}

[Injectable(TypePriority = OnLoadOrder.PostDBModLoader + 10)]
public class TGC(
    ISptLogger<TGC> logger,
    WTTServerCommonLib.WTTServerCommonLib wttCommon,
    ModHelper modHelper,
    DatabaseService databaseService) : IOnLoad
{
    public required DatabaseService DatabaseService;
    public required ModPresets ModPresets;
    public required Dictionary<MongoId, ModItems> ModItems;
    public required ModConfig ModConfig;
    public required ModTradersAssort ModTradersAssort;
    public required List<Suit> ModTraderSuitsList;
    public required Dictionary<MongoId, ModClothing> ModClothing;
    public required Dictionary<MongoId, TemplateItem> Items;
    public required Dictionary<MongoId, Trader> Traders;
    public required Dictionary<MongoId, CustomizationItem> CustomizationItems;
    public required Dictionary<string, LazyLoad<Dictionary<string, string>>> GlobalLocales;
    
    public async Task OnLoad()
    {
        DatabaseService = databaseService;
        Items = DatabaseService.GetItems();
        Traders = DatabaseService.GetTraders();
        CustomizationItems = DatabaseService.GetTemplates().Customization;
        GlobalLocales = DatabaseService.GetLocales().Global;
        
        // Get your current assembly
        Assembly assembly = Assembly.GetExecutingAssembly();
        
        MongoId armbandId = ItemTpl.INVENTORY_DEFAULT;
        MongoId traderIdPainter = "668aaff35fd574b6dcc4a686";
        List<MongoId> secureContainerIds = [ItemTpl.SECURE_CONTAINER_ALPHA,
                                            ItemTpl.SECURE_CONTAINER_BETA,
                                            ItemTpl.SECURE_CONTAINER_EPSILON,
                                            ItemTpl.SECURE_CONTAINER_GAMMA,
                                            ItemTpl.SECURE_CONTAINER_GAMMA_TUE,
                                            ItemTpl.SECURE_TOURNAMENT_SECURED_CONTAINER,
                                            ItemTpl.SECURE_CONTAINER_KAPPA,
                                            ItemTpl.SECURE_CONTAINER_KAPPA_DESECRATED,
                                            ItemTpl.SECURE_CONTAINER_THETA];
        
        string pathToMod = modHelper.GetAbsolutePathToModFolder(assembly);
        
        ModPresets = modHelper.GetJsonDataFromFile<ModPresets>(pathToMod, "db/globals.json");
        ModConfig = modHelper.GetJsonDataFromFile<ModConfig>(pathToMod, "config/config.json");
        ModItems = 
            modHelper.GetJsonDataFromFile<Dictionary<MongoId, ModItems>>(pathToMod, 
                "db/CustomItems/modTGC_items.json");
        ModClothing = 
            modHelper.GetJsonDataFromFile<Dictionary<MongoId, ModClothing>>(pathToMod, 
                "db/modTGC_clothes.json");

        ModTradersAssort =
            modHelper.GetJsonDataFromFile<ModTradersAssort>(pathToMod, 
                "db/traders/668aaff35fd574b6dcc4a686/assort.json");
        ModTraderSuitsList =
            modHelper.GetJsonDataFromFile<List<Suit>>(pathToMod,
                "db/traders/668aaff35fd574b6dcc4a686/suits.json");
        
        // Add item to database
        await wttCommon.CustomItemServiceExtended.CreateCustomItems(assembly);
        
        // Process items
        foreach (var kvp in ModItems)
        {
            MongoId modTgcId = kvp.Key;
            MongoId itemClone = kvp.Value.ItemTplToClone;
            
            // Copy to filters
            CopyToFilter(itemClone, modTgcId);
            
            // Add to armband slot if specified
            AddToArmband(kvp.Key, armbandId);
            
            // Add to secure container filters
            AddToSecureContainer(kvp.Key, secureContainerIds);
        }
        
        foreach (KeyValuePair<MongoId, ModClothing> kvp in ModClothing)
        {
            MongoId modTgcId = kvp.Key;
            MongoId itemToCloneId = kvp.Value.Clone;
            
            // Add clothing
            AddClothing(itemToCloneId, modTgcId);
            
            // Add locales
            AddLocales(modTgcId);
        }
        
        // Presets
        AddItemPresets();
        
        // Trader assort
        AddTraderAssort(traderIdPainter);
        
        // Trader suits
        AddTraderSuits(traderIdPainter);
        
        logger.Success("[TGC] Mod loaded successfully.");
        await Task.CompletedTask;
    }

    private void AddToArmband(MongoId modTgcId, MongoId armbandId)
    {
        if (ModItems[modTgcId].PutInArmband == null ||
            ModItems[modTgcId].PutInArmband != true)
            return;
        
        Items[armbandId].Properties!.Slots!.ToArray()[14].Properties!.Filters!.First().Filter!.Add(modTgcId);
    }

    private void AddToSecureContainer(MongoId modTgcId, List<MongoId> secureContainerIds)
    {
        if (!ModConfig.PouchesInSecureContainer ||
            ModItems[modTgcId].PutInArmband == null ||
            ModItems[modTgcId].PutInSecureContainer != true) 
            return;
            
        foreach (MongoId id in secureContainerIds)
        {
            Items[id].Properties.Grids.First().Properties.Filters!.First().Filter!.Add(modTgcId);
        }
    }

    private void CopyToFilter(MongoId itemClone, MongoId modTgcId)
    {
        foreach (KeyValuePair<MongoId, TemplateItem> kvp in Items)
        {
            if (ModItems.ContainsKey(kvp.Key))
                continue;
            
            (List<Slot> filters, List<MongoId> conflictingItems) = GetFilters(kvp.Key);

            foreach (Slot filter in filters)
            {
                if (filter.Properties == null ||
                    filter.Properties.Filters?.First().Filter == null)
                    continue;
                
                foreach (MongoId id in filter.Properties.Filters.First().Filter)
                {
                    if (id == kvp.Key)
                        filter.Properties.Filters.First().Filter.Add(modTgcId);
                }
            }

            foreach (MongoId id in conflictingItems.ToList())
            {
                if (id == itemClone)
                    conflictingItems.Add(modTgcId);
            }
        }
    }
    
    private (List<Slot> allSlots, List<MongoId> conflictingItems) GetFilters(string itemId)
    {
        IEnumerable<Slot> slots = Items[itemId].Properties!.Slots ?? [];
        IEnumerable<Slot> chambers = Items[itemId].Properties!.Chambers ?? [];
        IEnumerable<Slot> cartridges = Items[itemId].Properties!.Cartridges ?? [];
        
        List<Slot> allSlots = slots
            .Concat(chambers)
            .Concat(cartridges)
            .ToList();
        
        HashSet<MongoId> conflictingItems = Items[itemId].Properties!.ConflictingItems ?? [];
        
        return (allSlots, conflictingItems.ToList());
    }

    private void AddItemPresets()
    {
        foreach (KeyValuePair<MongoId, Preset> kvp in ModPresets.ModPreset)
        {
            DatabaseService.GetGlobals().ItemPresets[kvp.Key] = kvp.Value;
        }
    }

    private void AddTraderAssort(MongoId traderId)
    {
        // Add items to trader assort
        foreach (ModTradersAssort.TgcTraderItemsClass item in ModTradersAssort.TraderItems)
        {
            Traders[traderId].Assort.Items.Add(new Item
            {
                Id = item.Id,
                Template = item.Tpl,
                ParentId = item.ParentId,
                SlotId = item.SlotId,
                Upd = new Upd
                {
                    StackObjectsCount = item.Upd.StackObjectsCount,
                }
            });
        }

        foreach (KeyValuePair<MongoId, List<List<BarterScheme>>> item in ModTradersAssort.BarterSchemes)
        {
            Traders[traderId].Assort.BarterScheme[item.Key] = [];
            
            foreach (List<BarterScheme> scheme in item.Value)
            {
                Traders[traderId].Assort.BarterScheme[item.Key].Add(scheme);
            }
        }

        foreach (KeyValuePair<MongoId, int> loyalLevelItem in ModTradersAssort.LoyalLevelItems)
        { ;
            Traders[traderId].Assort.LoyalLevelItems[loyalLevelItem.Key] = loyalLevelItem.Value;
        }
    }
    
    private void AddTraderSuits(MongoId traderId)
    {
        Traders[traderId].Base.CustomizationSeller = true;

        if (Traders[traderId].Suits == null)
            Traders[traderId].Suits = [];
        
        foreach (Suit suit in ModTraderSuitsList)
        {
            Traders[traderId].Suits!.Add(suit);
        }
    }

    private void AddClothing(MongoId itemToCloneId, MongoId modTgcId)
    {
        CustomizationItem sourceItem = CustomizationItems[itemToCloneId];
        
        CustomizationProperties properties = ModClothing[modTgcId].CustomizationProperties.Props;

        CustomizationItem itemToAdd = DeepClone(sourceItem);

        itemToAdd.Id = modTgcId;
        itemToAdd.Name = modTgcId;
        itemToAdd.Properties = DeepClone(sourceItem.Properties);
        itemToAdd.Properties.Side   = properties.Side;
        itemToAdd.Properties.Prefab = properties.Prefab ?? itemToAdd.Properties.Prefab;
        itemToAdd.Properties.Body   = properties.Body   ?? itemToAdd.Properties.Body;
        itemToAdd.Properties.Hands  = properties.Hands  ?? itemToAdd.Properties.Hands;
        itemToAdd.Properties.Feet   = properties.Feet   ?? itemToAdd.Properties.Feet;
        
        CustomizationItems[modTgcId] = itemToAdd;
    }

    private void AddLocales(MongoId modTgcId)
    {
        foreach ((string localeCode, LazyLoad<Dictionary<string, string>> lazyLocale) in GlobalLocales)
        {
            lazyLocale.AddTransformer(localeData =>
            {
                if (localeData == null)
                    return localeData;

                LocaleDetails? localeInfo = ModClothing[modTgcId].Locales.GetValueOrDefault(localeCode) ??
                                            ModClothing[modTgcId].Locales.GetValueOrDefault("en");

                if (localeInfo == null)
                    return localeData;

                MongoId itemKey = modTgcId;
                string nameKey = $"{modTgcId} name";
                string descriptionKey = $"{modTgcId} description";

                string nameValue = localeInfo.Name ?? "";
                string descriptionValue = localeInfo.Description ?? "";

                localeData[itemKey] = nameValue;
                localeData[nameKey] = nameValue;
                localeData[descriptionKey] = descriptionValue;
                
                return localeData;
            });
        }
    }
    
    private static T DeepClone<T>(T obj)
    {
        string json = JsonSerializer.Serialize(obj);
        return JsonSerializer.Deserialize<T>(json)!;
    }
}