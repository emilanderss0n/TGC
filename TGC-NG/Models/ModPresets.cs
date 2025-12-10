using System.Text.Json.Serialization;
using SPTarkov.Server.Core.Models.Common;
using SPTarkov.Server.Core.Models.Eft.Common;

namespace TGC.Models;

public class ModPresets
{
    [JsonPropertyName("ItemPresets")]
    public Dictionary<MongoId, Preset> ModPreset { get; set; }
}