from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from .models import NetworkQualityLog, UserInteraction, CampusLocation, CAMPUS_ZONES, ZONE_CHOICES
from django.core.cache import cache


# ─── Serializers ──────────────────────────────────────────────────────────────

class NetworkQualitySerializer(serializers.ModelSerializer):
    class Meta:
        model = NetworkQualityLog
        fields = ['download_kbps', 'latency_ms', 'location_hint']


class UserInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserInteraction
        fields = ['resource', 'event_type', 'session_id',
                  'time_on_resource', 'query_used', 'metadata']


# ─── Views ────────────────────────────────────────────────────────────────────

class NetworkQualityLogView(APIView):
    """
    POST: Client reports its current network quality.
    Used by the recommendation engine to serve lighter resources when bandwidth is low.
    """

    def post(self, request):
        serializer = NetworkQualitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response({'message': 'Qualité réseau enregistrée.'}, status=status.HTTP_201_CREATED)

    def get(self, request):
        """Return the latest network quality entry for the current user."""
        log = NetworkQualityLog.objects.filter(user=request.user).first()
        if not log:
            return Response({'download_kbps': None, 'latency_ms': None})
        return Response(NetworkQualitySerializer(log).data)


class UserInteractionLogView(APIView):
    """
    POST: Record a single interaction event (view, click, download …).
    GET:  Return the 50 most recent events for the current user.
    """

    def post(self, request):
        serializer = UserInteractionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response({'message': 'Interaction enregistrée.'}, status=status.HTTP_201_CREATED)

    def get(self, request):
        events = UserInteraction.objects.filter(
            user=request.user
        ).select_related('resource')[:50]
        return Response(UserInteractionSerializer(events, many=True).data)


class CampusZoneView(APIView):
    """
    GET:  Returns the user's current campus zone.
    POST: Updates the user's campus zone (invalidates recommendation cache).
    """

    def get(self, request):
        try:
            loc = request.user.campus_location
            return Response({'zone': loc.zone, 'label': CAMPUS_ZONES[loc.zone]['label']})
        except CampusLocation.DoesNotExist:
            return Response({'zone': 'off_campus', 'label': CAMPUS_ZONES['off_campus']['label']})

    def post(self, request):
        zone = request.data.get('zone', 'off_campus')
        valid_zones = [k for k, _ in ZONE_CHOICES]
        if zone not in valid_zones:
            return Response({'error': 'Zone invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        CampusLocation.objects.update_or_create(
            user=request.user,
            defaults={'zone': zone},
        )
        # Invalidate recommendation cache so next load uses new zone
        for n in [12, 8, 6]:
            cache.delete(f'reco_{request.user.id}_{n}')

        return Response({'zone': zone, 'label': CAMPUS_ZONES[zone]['label']})


# ─── URLs (inlined) ───────────────────────────────────────────────────────────
from django.urls import path

urlpatterns = [
    path('network/',      NetworkQualityLogView.as_view(),  name='context_network'),
    path('interactions/', UserInteractionLogView.as_view(), name='context_interactions'),
    path('zone/',         CampusZoneView.as_view(),         name='context_zone'),
]
