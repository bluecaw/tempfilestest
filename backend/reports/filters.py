# reports/filters.py
import django_filters
from .models import Report

class ReportFilter(django_filters.FilterSet):
    # 1. 開始日・終了日の範囲指定（片方だけの指定にも対応）
    start_date = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    end_date = django_filters.DateFilter(field_name='date', lookup_expr='lte')
    
    # 2. 担当者（作成者ユーザーID）フィルター
    created_by = django_filters.NumberFilter(field_name='created_by__id')

    # 3. 承認ステータスフィルター（Draft, Pending, Approved, Rejected）
    status = django_filters.CharFilter(field_name='status', lookup_expr='exact')

    class Meta:
        model = Report
        fields = ['start_date', 'end_date', 'created_by', 'status']