using System.Text.Json.Serialization;
using SPTarkov.Server.Core.Models.Common;
using SPTarkov.Server.Core.Models.Eft.Common.Tables;

namespace TGC.Models;

public class ModTradersAssort
{
    [JsonPropertyName("items")] 
    public required List<TgcTraderItemsClass> TraderItems { get; set; }
    
    public class TgcTraderItemsClass
    {
        [JsonPropertyName("_id")]
        public MongoId Id { get; set; }
        [JsonPropertyName("_tpl")]
        public MongoId Tpl { get; set; }
        [JsonPropertyName("parentId")]
        public required string ParentId { get; set; }
        [JsonPropertyName("slotId")]
        public required string SlotId { get; set; }
        [JsonPropertyName("upd")]
        public Upd Upd { get; set; } = new();
    }
    
    [JsonPropertyName("barter_scheme")]
    public required Dictionary<MongoId, List<List<BarterScheme>>> BarterSchemes { get; set; }
    
    [JsonPropertyName("loyal_level_items")]
    public Dictionary<MongoId, int> LoyalLevelItems { get; set; }
}