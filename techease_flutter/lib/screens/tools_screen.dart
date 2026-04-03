import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';

class ToolsScreen extends StatefulWidget {
  const ToolsScreen({super.key});

  @override
  State<ToolsScreen> createState() => _ToolsScreenState();
}

class _ToolsScreenState extends State<ToolsScreen> {
  bool checking = false;
  bool? healthy;

  Future<void> _checkBackend() async {
    setState(() => checking = true);
    final apiClient = context.read<ApiClient>();
    final ok = await apiClient.healthCheck();
    if (!mounted) return;
    setState(() {
      healthy = ok;
      checking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final apiClient = context.read<ApiClient>();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Tools & Purpose', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Operational tools and project value summary for demos and real school usage.'),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Backend Connection', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 8),
                Text('API Base URL: ${apiClient.baseUrl}'),
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: checking ? null : _checkBackend,
                  icon: const Icon(Icons.health_and_safety_outlined),
                  label: Text(checking ? 'Checking...' : 'Run Health Check'),
                ),
                if (healthy != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    healthy == true ? 'Backend is reachable and healthy.' : 'Backend check failed. Verify IP, Wi-Fi, and server.',
                    style: TextStyle(
                      color: healthy == true ? const Color(0xFF0F766E) : const Color(0xFFB91C1C),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ]
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        const Card(
          child: Padding(
            padding: EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Core Use Cases', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                SizedBox(height: 8),
                Text('1. Daily attendance marking from phone in under 2 minutes.'),
                Text('2. Student lookup with details during parent calls or staff meetings.'),
                Text('3. Class-level insight review for intervention planning.'),
                Text('4. Consistent workflow with web platform for teacher continuity.'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        const Card(
          child: Padding(
            padding: EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Demo Script', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                SizedBox(height: 8),
                Text('Step 1: Login as teacher and open dashboard overview.'),
                Text('Step 2: Open class details to show roster and context.'),
                Text('Step 3: Mark attendance with review and confirm lock.'),
                Text('Step 4: Open analytics to justify impact with attendance trends.'),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
