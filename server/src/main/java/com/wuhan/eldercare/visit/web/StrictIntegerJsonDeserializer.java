package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

import java.io.IOException;

/** Accepts only JSON integer tokens for Contract rating fields; rejects coercion from strings/floats. */
public final class StrictIntegerJsonDeserializer extends StdDeserializer<Integer> {
    public StrictIntegerJsonDeserializer() {
        super(Integer.class);
    }

    @Override
    public Integer deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT) {
            throw JsonMappingException.from(parser, "rating must be a JSON integer");
        }
        return parser.getIntValue();
    }
}
