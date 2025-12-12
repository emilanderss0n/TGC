using System.Text.Json.Serialization;
using SPTarkov.Server.Core.Models.Common;

namespace TGC.Models;

public class ModItems
{
    [JsonPropertyName("itemTplToClone")]
    public MongoId ItemTplToClone { get; set; }
    [JsonPropertyName("PutInArmband")]
    public bool? PutInArmband { get; set; }
    [JsonPropertyName("putInSecureContainer")]
    public bool? PutInSecureContainer { get; set; }
    [JsonPropertyName("addToThisItemsFilters")]
    public Dictionary<string, List<MongoId>>? AddToThisItemsFilters { get; set; }
    [JsonPropertyName("addToExistingItemFilters")]
    public Dictionary<string, List<MongoId>>? AddToExistingItemFilters { get; set; }
}