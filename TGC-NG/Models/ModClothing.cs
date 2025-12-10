using System.Text.Json.Serialization;
using SPTarkov.Server.Core.Models.Common;
using SPTarkov.Server.Core.Models.Eft.Common.Tables;
using SPTarkov.Server.Core.Models.Spt.Mod;

namespace TGC.Models;

public class ModClothing
{
    [JsonPropertyName("clone")]
    public MongoId Clone { get; set; }
    [JsonPropertyName("customization")]
    public required CustomizationWrapper CustomizationProperties { get; set; }
    [JsonPropertyName("locales")]
    public required Dictionary<string, LocaleDetails> Locales { get; set; }
}

public class CustomizationWrapper
{
    [JsonPropertyName("_props")]
    public required CustomizationProperties Props { get; set; }
}