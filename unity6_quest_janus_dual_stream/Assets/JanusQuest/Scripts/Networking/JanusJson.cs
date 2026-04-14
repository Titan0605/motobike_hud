using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;

namespace JanusQuest.Networking
{
    internal static class JanusJson
    {
        public static string Serialize(object value)
        {
            var sb = new StringBuilder(256);
            WriteValue(sb, value);
            return sb.ToString();
        }

        public static bool TryGetString(string json, string key, out string value)
        {
            value = string.Empty;
            var pattern = $"\"{Regex.Escape(key)}\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"";
            var match = Regex.Match(json, pattern);
            if (!match.Success)
            {
                return false;
            }

            value = Unescape(match.Groups[1].Value);
            return true;
        }

        public static bool TryGetLong(string json, string key, out long value)
        {
            value = 0;
            var pattern = $"\"{Regex.Escape(key)}\"\\s*:\\s*(-?\\d+)";
            var match = Regex.Match(json, pattern);
            return match.Success && long.TryParse(match.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
        }

        public static bool TryGetInt(string json, string key, out int value)
        {
            value = 0;
            var pattern = $"\"{Regex.Escape(key)}\"\\s*:\\s*(-?\\d+)";
            var match = Regex.Match(json, pattern);
            return match.Success && int.TryParse(match.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
        }

        public static bool TryGetObject(string json, string key, out string objectJson)
        {
            objectJson = string.Empty;
            var keyToken = $"\"{key}\"";
            var keyIndex = json.IndexOf(keyToken, StringComparison.Ordinal);
            if (keyIndex < 0)
            {
                return false;
            }

            var colonIndex = json.IndexOf(':', keyIndex + keyToken.Length);
            if (colonIndex < 0)
            {
                return false;
            }

            var startIndex = json.IndexOf('{', colonIndex + 1);
            if (startIndex < 0)
            {
                return false;
            }

            var depth = 0;
            var inString = false;
            var escaped = false;

            for (var i = startIndex; i < json.Length; i++)
            {
                var c = json[i];

                if (inString)
                {
                    if (!escaped && c == '\\')
                    {
                        escaped = true;
                        continue;
                    }

                    if (!escaped && c == '"')
                    {
                        inString = false;
                    }

                    escaped = false;
                    continue;
                }

                if (c == '"')
                {
                    inString = true;
                    continue;
                }

                if (c == '{')
                {
                    depth++;
                }
                else if (c == '}')
                {
                    depth--;
                    if (depth == 0)
                    {
                        objectJson = json.Substring(startIndex, i - startIndex + 1);
                        return true;
                    }
                }
            }

            return false;
        }

        private static void WriteValue(StringBuilder sb, object value)
        {
            if (value == null)
            {
                sb.Append("null");
                return;
            }

            switch (value)
            {
                case string s:
                    sb.Append('"').Append(Escape(s)).Append('"');
                    return;
                case bool b:
                    sb.Append(b ? "true" : "false");
                    return;
                case int or long or float or double or decimal or short or byte:
                    sb.Append(Convert.ToString(value, CultureInfo.InvariantCulture));
                    return;
                case IDictionary dict:
                    WriteDictionary(sb, dict);
                    return;
                case IEnumerable enumerable when value is not string:
                    WriteArray(sb, enumerable);
                    return;
                default:
                    WriteObject(sb, value);
                    return;
            }
        }

        private static void WriteDictionary(StringBuilder sb, IDictionary dict)
        {
            sb.Append('{');
            var first = true;
            foreach (DictionaryEntry entry in dict)
            {
                if (!first)
                {
                    sb.Append(',');
                }

                sb.Append('"').Append(Escape(Convert.ToString(entry.Key, CultureInfo.InvariantCulture))).Append('"').Append(':');
                WriteValue(sb, entry.Value);
                first = false;
            }
            sb.Append('}');
        }

        private static void WriteArray(StringBuilder sb, IEnumerable enumerable)
        {
            sb.Append('[');
            var first = true;
            foreach (var item in enumerable)
            {
                if (!first)
                {
                    sb.Append(',');
                }

                WriteValue(sb, item);
                first = false;
            }
            sb.Append(']');
        }

        private static void WriteObject(StringBuilder sb, object obj)
        {
            var type = obj.GetType();
            var props = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
            sb.Append('{');
            var first = true;

            foreach (var prop in props)
            {
                if (!prop.CanRead || prop.GetIndexParameters().Length > 0)
                {
                    continue;
                }

                var val = prop.GetValue(obj, null);
                if (!first)
                {
                    sb.Append(',');
                }

                sb.Append('"').Append(Escape(prop.Name)).Append('"').Append(':');
                WriteValue(sb, val);
                first = false;
            }

            sb.Append('}');
        }

        private static string Escape(string value)
        {
            return value
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\n", "\\n")
                .Replace("\r", "\\r")
                .Replace("\t", "\\t");
        }

        private static string Unescape(string value)
        {
            var unescaped = value
                .Replace("\\/", "/")
                .Replace("\\\"", "\"")
                .Replace("\\\\", "\\")
                .Replace("\\n", "\n")
                .Replace("\\r", "\r")
                .Replace("\\t", "\t");

            return unescaped;
        }
    }
}
