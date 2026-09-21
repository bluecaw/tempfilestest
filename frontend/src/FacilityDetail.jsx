// FacilityDetail.jsx / FacilityList.jsx 等での利用例
import React from 'react';
import AddressMapLink from './AddressMapLink';

const FacilityItem = ({ facility }) => {
    return (
        <div className="p-4 border rounded-lg shadow-sm">
            <h3 className="text-xl font-bold">{facility.name}</h3>
            <div className="mt-2">
                <span className="text-gray-600 mr-2">住所:</span>
                <AddressMapLink
                    address={facility.address}
                    latitude={facility.latitude}
                    longitude={facility.longitude}
                />
            </div>
        </div>
    );
};

export default FacilityItem;