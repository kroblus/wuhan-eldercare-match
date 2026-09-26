package com.wuhan.eldercare.visit.elder.application;

import com.wuhan.eldercare.visit.elder.domain.ElderRecord;

public interface ElderRecordRepository {
    Lookup findByResponsibleUserId(String responsibleUserId);

    Establish establish(ElderRecord candidate);

    record Lookup(Status status, ElderRecord record) {
        public enum Status { FOUND, NOT_FOUND, UNAVAILABLE, TECHNICAL_FAILURE }

        public Lookup {
            if (status == null || ((status == Status.FOUND) != (record != null))) {
                throw new IllegalArgumentException("Elder lookup state and record must agree");
            }
        }

        public static Lookup found(ElderRecord record) { return new Lookup(Status.FOUND, record); }
        public static Lookup of(Status status) { return new Lookup(status, null); }
    }

    record Establish(Status status, ElderRecord record) {
        public enum Status { CREATED, ALREADY_BOUND, UNAVAILABLE, TECHNICAL_FAILURE }

        public Establish {
            if (status == null || ((status == Status.CREATED || status == Status.ALREADY_BOUND) != (record != null))) {
                throw new IllegalArgumentException("Elder establish state and record must agree");
            }
        }

        public static Establish created(ElderRecord record) { return new Establish(Status.CREATED, record); }
        public static Establish alreadyBound(ElderRecord record) { return new Establish(Status.ALREADY_BOUND, record); }
        public static Establish of(Status status) { return new Establish(status, null); }
    }
}
