package com.wuhan.eldercare.visit.elder.persistence;

import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import com.wuhan.eldercare.visit.elder.domain.ElderRecord;

public final class UnavailableElderRecordRepository implements ElderRecordRepository {
    @Override
    public Lookup findByResponsibleUserId(String responsibleUserId) {
        return Lookup.of(Lookup.Status.UNAVAILABLE);
    }

    @Override
    public Establish establish(ElderRecord candidate) {
        return Establish.of(Establish.Status.UNAVAILABLE);
    }
}
