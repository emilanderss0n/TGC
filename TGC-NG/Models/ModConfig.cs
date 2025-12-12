using System.Text.Json.Serialization;

namespace TGC.Models;

public class ModConfig
{
    [JsonPropertyName("PouchesInSecureContainer")]
    public bool PouchesInSecureContainer { get; set; }
}