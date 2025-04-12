import React from 'react';
import CountItems from './CountItems';
import AdminView from './AdminView';

const MonthlyCount = ({ userType, selectedLocation }) => {
  return (
    <div className="bg-curaleaf-light p-8 rounded-xl shadow-soft">
      {userType === 'admin' ? (
        <AdminView userType={userType} selectedLocation={selectedLocation} />
      ) : (
        <CountItems userType={userType} selectedLocation={selectedLocation} />
      )}
    </div>
  );
};

export default MonthlyCount;